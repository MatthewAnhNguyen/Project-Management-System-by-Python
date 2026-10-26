from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, Union
from datetime import datetime, timezone

from app import models, schemas
from app.database import get_db
from app.security import get_current_user
from app.routers.workspaces import log_workspace_activity

router = APIRouter(tags=["Team Meetings & Calendar"])

def normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
    """Chuyển datetime về dạng naive UTC để đồng nhất lưu trữ & so sánh trong database."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

def to_utc_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """Gắn timezone UTC trước khi trả về client để JSON serialize có hậu tố Z chuẩn."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def parse_flexible_datetime(val: Optional[Union[str, datetime]]) -> Optional[datetime]:
    """Parse linh hoạt tham số ngày giờ từ query param (hỗ trợ cả khi dấu + bị decode thành khoảng trắng)."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return normalize_dt(val)
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None
        val_clean = val.replace(" ", "+")
        try:
            dt = datetime.fromisoformat(val_clean)
            return normalize_dt(dt)
        except Exception:
            try:
                dt = datetime.strptime(val[:10], "%Y-%m-%d")
                return dt
            except Exception:
                return None
    return None

def check_workspace_membership(workspace_id: str, user_id: str, db: Session):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace không tồn tại!")

    is_owner = (str(workspace.owner_id) == str(user_id))

    is_member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == user_id
    ).first()

    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không phải thành viên trong Workspace này!"
        )
    return workspace

def check_workspace_owner(workspace_id: str, user_id: str, db: Session):
    clean_ws_id = str(workspace_id).replace('#', '').strip()
    clean_uid = str(user_id).replace('#', '').strip()
    workspace = db.query(models.Workspace).filter(
        or_(models.Workspace.id == workspace_id, models.Workspace.id == clean_ws_id)
    ).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace không tồn tại!"
        )

    if str(workspace.owner_id).replace('#', '').strip() != clean_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền tạo và thao tác cuộc họp!"
        )
    return workspace

@router.post("/workspaces/{workspace_id}/meetings", response_model=schemas.MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(
    workspace_id: str,
    meeting_data: schemas.MeetingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    workspace = check_workspace_owner(workspace_id, current_user.id, db)

    start_dt = normalize_dt(meeting_data.start_time)
    end_dt = normalize_dt(meeting_data.end_time)

    if start_dt and end_dt and start_dt >= end_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian kết thúc cuộc họp phải sau thời gian bắt đầu!"
        )

    link = meeting_data.meeting_link
    if not link or not link.strip():
        link = f"https://meet.jit.si/pms-ws{workspace_id}-meeting-{int(start_dt.timestamp() if start_dt else 0)}"

    new_meeting = models.Meeting(
        title=meeting_data.title.strip(),
        description=meeting_data.description,
        meeting_link=link.strip(),
        start_time=start_dt,
        end_time=end_dt,
        workspace_id=workspace_id,
        creator_id=current_user.id,
        task_id=meeting_data.task_id
    )

    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)

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
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    check_workspace_membership(workspace_id, current_user.id, db)
    from_dt = parse_flexible_datetime(from_date)
    to_dt = parse_flexible_datetime(to_date)

    query = db.query(models.Meeting).filter(models.Meeting.workspace_id == workspace_id)
    if from_dt:
        query = query.filter(models.Meeting.end_time >= from_dt)
    if to_dt:
        query = query.filter(models.Meeting.start_time <= to_dt)
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
            detail="Cuộc họp không tồn tại!"
        )
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
            detail="Cuộc họp không tồn tại!"
        )
    workspace = db.query(models.Workspace).filter(models.Workspace.id == meeting.workspace_id).first()
    clean_uid = str(current_user.id).replace('#', '').strip()
    is_owner = (workspace and str(workspace.owner_id).replace('#', '').strip() == clean_uid)
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền sửa cuộc họp!"
        )

    new_start = normalize_dt(update_data.start_time) if update_data.start_time is not None else normalize_dt(meeting.start_time)
    new_end = normalize_dt(update_data.end_time) if update_data.end_time is not None else normalize_dt(meeting.end_time)

    if new_start and new_end and new_start >= new_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian kết thúc phải diễn ra sau thời gian bắt đầu!"
        )

    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        if key in ("start_time", "end_time") and value is not None:
            value = normalize_dt(value)
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
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuộc họp không tồn tại!"
        )
    workspace = db.query(models.Workspace).filter(models.Workspace.id == meeting.workspace_id).first()
    clean_uid = str(current_user.id).replace('#', '').strip()
    is_owner = (workspace and str(workspace.owner_id).replace('#', '').strip() == clean_uid)
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền xóa cuộc họp!"
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
        from_date: Optional[str] = Query(None),
        to_date: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    check_workspace_membership(workspace_id, current_user.id, db)

    from_dt = parse_flexible_datetime(from_date)
    to_dt = parse_flexible_datetime(to_date)

    events = []

    meeting_query = db.query(models.Meeting).filter(models.Meeting.workspace_id == workspace_id)
    if from_dt:
        meeting_query = meeting_query.filter(models.Meeting.end_time >= from_dt)
    if to_dt:
        meeting_query = meeting_query.filter(models.Meeting.start_time <= to_dt)

    for m in meeting_query.all():
        creator_name = m.creator.username if m.creator else "Thành viên"
        events.append(schemas.CalendarEventResponse(
            id=f"meeting-{m.id}",
            title=f"📅 [Họp] {m.title}",
            start_time=to_utc_datetime(m.start_time),
            end_time=to_utc_datetime(m.end_time),
            event_type="MEETING",
            description=m.description,
            meeting_link=m.meeting_link,
            creator_name=creator_name,
            workspace_id=m.workspace_id
        ))

    task_query = db.query(models.Task).filter(
        models.Task.workspace_id == workspace_id,
        models.Task.due_date.isnot(None)
    )
    if from_dt:
        task_query = task_query.filter(models.Task.due_date >= from_dt)
    if to_dt:
        task_query = task_query.filter(models.Task.due_date <= to_dt)

    for t in task_query.all():
        assignee_name = t.assignee.username if t.assignee else "Chưa gán"
        events.append(schemas.CalendarEventResponse(
            id=f"task-{t.id}",
            title=f"📌 [Hạn chót] {t.title}",
            start_time=to_utc_datetime(t.due_date),
            end_time=to_utc_datetime(t.due_date),
            event_type="TASK_DEADLINE",
            description=t.description,
            task_status=t.status,
            task_priority=t.priority,
            assignee_name=assignee_name,
            workspace_id=t.workspace_id
        ))

    events.sort(key=lambda x: x.start_time)
    return events


