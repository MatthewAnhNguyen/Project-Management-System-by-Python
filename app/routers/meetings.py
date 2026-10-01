from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

# Import models, schemas và security từ project
from app import models, schemas
from app.database import get_db
from app.security import get_current_user

# Tạo đối tượng router và gắn thẻ nhóm để hiển thị đẹp trên Swagger UI (/docs)
router = APIRouter(tags=["Team Meetings & Calendar"])

# Helper đảm bảo user đang gọi API thực sự thuộc workspace đó
def check_workspace_membership(workspace_id: int, user_id: int, db: Session):
    #1. Tìm workspace theo ID
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace không tồn tại!")

    #2. Kiểm tra xem user có phải là Chủ sở hữu không
    is_owner = (workspace.owner_id == user_id)

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
def check_workspace_owner(workspace_id: int, user_id: int, db: Session):
    #1. Tìm workspace theo ID
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace không tồn tại!"
        )

    #2. Kiểm tra quyền Chủ sở hữu: owner_id có khớp với id của người đăng nhập không
    if workspace.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ chủ sở hữu của Workspace mới có quyền tạo cuộc họp cho nhóm!"
        )
    return workspace

@router.post("/workspaces/{workspace_id}/meetings", response_model=schemas.MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(
    workspace_id: int,
    meeting_data: schemas.MeetingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Bước 1: KIỂM TRA QUYỀN - Chỉ Owner mới được đi tiếp
    workspace = check_workspace_owner(workspace_id, current_user.id, db)

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

    return new_meeting

@router.get("/workspaces/{workspace_id}/meetings", response_model=list[schemas.MeetingResponse], status_code=status.HTTP_200_OK)
def get_meetings(
    workspace_id: int,
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
        meeting_id: int,
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
        meeting_id: int,
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
    check_workspace_owner(meeting.workspace_id, current_user.id, db)
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
    return meeting

@router.delete("/meetings/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
        meeting_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    meeting=db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail = "Cuộc họp không tồn tại!"
        )
    check_workspace_owner(meeting.workspace_id, current_user.id, db)
    db.delete(meeting)
    db.commit()
    return





