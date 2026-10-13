from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

# Import models, schemas và security từ project
from app import models, schemas
from app.database import get_db
from app.security import get_current_user
from app.routers.workspaces import log_workspace_activity

# Tạo đối tượng router và gắn thẻ nhóm để hiển thị đẹp trên Swagger UI (/docs)
router = APIRouter(tags=["Team Meetings & Calendar"])

# Helper đảm bảo user đang gọi API thực sự thuộc workspace đó
def check_workspace_membership(workspace_id: str, user_id: str, db: Session):
    #1. Tìm workspace theo ID
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace không tồn tại!")

    #2. Kiểm tra xem user có phải là Chủ sở hữu không
    is_owner = (str(workspace.owner_id) == str(user_id))

    #3. Kiểm tra xem user có nằm trong danh sách thành viên không
    is_member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == user_id
    ).first()

    #4. Nếu không phải cả hai -> Báo lỗi 403 Forbidden
    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không phải thành viên trong Workspace này!"
        )
    return workspace

# Helper kiểm tra quyền Owner riêng
def check_workspace_owner(workspace_id: str, user_id: str, db: Session):
    #1. Tìm workspace theo ID
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace không tồn tại!"
        )

    #2. Kiểm tra quyền Chủ sở hữu: owner_id có khớp với id của người đăng nhập không
    if str(workspace.owner_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ chủ sở hữu của Workspace mới có quyền tạo cuộc họp cho nhóm!"
        )
    return workspace

@router.post("/workspaces/{workspace_id}/meetings", response_model=schemas.MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(
    workspace_id: str,
    meeting_data: schemas.MeetingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Bước 1: KIỂM TRA QUYỀN - Owner hoặc Member đều được lên lịch họp
    workspace = check_workspace_membership(workspace_id, current_user.id, db)

    # Bước 2: KIỂM TRA THỜI GIAN HỢP LỆ
    if meeting_data.start_time >= meeting_data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian kết thúc cuộc họp phải sau thời gian bắt đầu!"
        )

    # Bước 3: XỬ LÝ LINK HỌP (Tự sinh link nếu chủ nhóm để trống)
    link = meeting_data.meeting_link
    if not link or not link.strip():
        # Tạo link Jitsi Meet ngẫu nhiên miễn phí không cần cấu hình API Google
        link = f"https://meet.jit.si/pms-ws{workspace_id}-meeting-{int(meeting_data.start_time.timestamp())}"

    # BƯỚC 4: TẠO BẢN GHI VÀ LƯU VÀO DATABASE
    new_meeting = models.Meeting(
        title=meeting_data.title.strip(),
        description=meeting_data.description,
        meeting_link=link.strip(),
        start_time=meeting_data.start_time,
        end_time=meeting_data.end_time,
        workspace_id=workspace_id,
        creator_id=current_user.id,
        task_id=meeting_data.task_id
    )

    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)

    # Ghi log hoạt động Workspace
    log_workspace_activity(
        workspace_id=workspace_id,
        user_id=current_user.id,
        action_type="MEETING_CREATED",
        description=f"{current_user.username} đã lên lịch cuộc họp '{new_meeting.title}'",
        db=db
    )

    return new_meeting

@router.get("/workspaces/{workspace_id}/meetings", response_model=list[schemas.MeetingResponse], status_code=status.HTTP_200_OK)
def get_meetings(
    workspace_id: str,
    from_date: Optional[datetime]=None,
    to_date: Optional[datetime]=None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    check_workspace_membership(workspace_id, current_user.id, db)
    query = db.query(models.Meeting).filter(models.Meeting.workspace_id == workspace_id)
    if from_date:
        query = query.filter(models.Meeting.start_time >= from_date)
    if to_date:
        query = query.filter(models.Meeting.end_time <= to_date)
    query = query.order_by(models.Meeting.start_time.asc())

    return query.all()

@router.get("/meetings/{meeting_id}", response_model=schemas.MeetingResponse)
def get_meeting(
        meeting_id: str,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail = "Cuộc họp không tồn tại!"
        )
    workspace_id = meeting.workspace_id
    check_workspace_membership(meeting.workspace_id, current_user.id, db)
    return meeting

@router.put("/meetings/{meeting_id}", response_model=schemas.MeetingResponse)
def update_meeting(
        meeting_id: str,
        update_data: schemas.MeetingUpdate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail = "Cuộc họp không tồn tại!"
        )
    workspace = db.query(models.Workspace).filter(models.Workspace.id == meeting.workspace_id).first()
    is_creator = (str(meeting.creator_id) == str(current_user.id))
    is_owner = (workspace and str(workspace.owner_id) == str(current_user.id))
    if not is_creator and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail = "Chỉ người tạo cuộc họp hoặc chủ sở hữu Workspace mới có quyền sửa cuộc họp!"
        )
    new_start = update_data.start_time if update_data.start_time else meeting.start_time
    new_end = update_data.end_time if update_data.end_time else meeting.end_time
    if new_start >= new_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail = "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu!"
        )
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(meeting, key, value)
    db.commit()
    db.refresh(meeting)
    log_workspace_activity(
        workspace_id=meeting.workspace_id,
        user_id=current_user.id,
        action_type="MEETING_UPDATED",
        description=f"{current_user.username} đã cập nhật cuộc họp '{meeting.title}'",
        db=db
    )
    return meeting

@router.delete("/meetings/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
        meeting_id: str,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    meeting=db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail = "Cuộc họp không tồn tại!"
        )
    workspace = db.query(models.Workspace).filter(models.Workspace.id == meeting.workspace_id).first()
    is_creator = (str(meeting.creator_id) == str(current_user.id))
    is_owner = (workspace and str(workspace.owner_id) == str(current_user.id))
    if not is_creator and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail = "Chỉ người tạo cuộc họp hoặc chủ sở hữu Workspace mới có quyền xóa cuộc họp!"
        )
    log_workspace_activity(
        workspace_id=meeting.workspace_id,
        user_id=current_user.id,
        action_type="MEETING_DELETED",
        description=f"{current_user.username} đã xóa cuộc họp '{meeting.title}'",
        db=db
    )
    db.delete(meeting)
    db.commit()
    return


@router.get("/workspaces/{workspace_id}/calendar-events", response_model=list[schemas.CalendarEventResponse])
def get_calendar_events(
        workspace_id: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    # 1. Kiểm tra quyền truy cập workspace
    check_workspace_membership(workspace_id, current_user.id, db)

    events = []

    # 2. Lấy dữ liệu Cuộc họp (Meetings)
    meeting_query = db.query(models.Meeting).filter(models.Meeting.workspace_id == workspace_id)
    if from_date:
        meeting_query = meeting_query.filter(models.Meeting.start_time >= from_date)
    if to_date:
        meeting_query = meeting_query.filter(models.Meeting.end_time <= to_date)

    for m in meeting_query.all():
        events.append(schemas.CalendarEventResponse(
            id=f"meeting-{m.id}",
            title=f"📅 [Họp] {m.title}",
            start_time=m.start_time,
            end_time=m.end_time,
            event_type="MEETING",
            description=m.description,
            meeting_link=m.meeting_link
        ))

    # 3. Lấy dữ liệu Hạn chót Task (Tasks with due_date)
    task_query = db.query(models.Task).filter(
        models.Task.workspace_id == workspace_id,
        models.Task.due_date.isnot(None)
    )
    if from_date:
        task_query = task_query.filter(models.Task.due_date >= from_date)
    if to_date:
        task_query = task_query.filter(models.Task.due_date <= to_date)

    for t in task_query.all():
        assignee_name = t.assignee.username if t.assignee else "Chưa gán"
        events.append(schemas.CalendarEventResponse(
            id=f"task-{t.id}",
            title=f"📌 [Hạn chót] {t.title}",
            start_time=t.due_date,
            end_time=t.due_date,
            event_type="TASK_DEADLINE",
            description=t.description,
            task_status=t.status,
            task_priority=t.priority,
            assignee_name=assignee_name
        ))

    # Sắp xếp các sự kiện theo thứ tự thời gian tăng dần
    events.sort(key=lambda x: x.start_time)
    return events




