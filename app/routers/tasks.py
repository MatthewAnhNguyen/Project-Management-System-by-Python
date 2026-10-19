from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional

from app import models, schemas
from app.database import get_db
from app.security import get_current_user
from app.routers.comments import log_task_activity
from app.routers.workspaces import log_workspace_activity

router = APIRouter(tags=["Tasks"])

# Hàm Helper kiểm tra xem user có phải là Owner hoặc Member của Workspace không
def check_workspace_access(workspace_id: str, user_id: str, db: Session):
    clean_ws_id = str(workspace_id).replace('#', '').strip()
    clean_uid = str(user_id).replace('#', '').strip() if user_id else ""
    workspace = db.query(models.Workspace).filter(
        or_(models.Workspace.id == workspace_id, models.Workspace.id == clean_ws_id)
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại!")

    is_owner = (str(workspace.owner_id).replace('#', '').strip() == clean_uid)
    is_member = db.query(models.WorkspaceMember).filter(
        or_(models.WorkspaceMember.workspace_id == workspace.id, models.WorkspaceMember.workspace_id == clean_ws_id),
        models.WorkspaceMember.user_id == clean_uid
    ).first()

    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Người dùng không thuộc Workspace này!")

    return workspace


# 1. TẠO TASK MỚI TRONG WORKSPACE
@router.post("/workspaces/{workspace_id}/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    workspace_id: str,
    task_data: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Kiểm tra quyền truy cập workspace
    workspace = check_workspace_access(workspace_id, current_user.id, db)

    # CHỈ OWNER CỦA WORKSPACE MỚI CÓ QUYỀN TẠO VÀ GÁN CÔNG VIỆC
    clean_uid = str(current_user.id).replace('#', '').strip()
    is_owner = (str(workspace.owner_id).replace('#', '').strip() == clean_uid)
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền tạo và gán công việc!"
        )

    # Nếu giao task cho 1 assignee, kiểm tra assignee có thuộc workspace không
    clean_assignee_id = None
    if task_data.assignee_id and str(task_data.assignee_id).strip() and str(task_data.assignee_id).lower() != "null":
        clean_assignee_id = str(task_data.assignee_id).replace('#', '').strip()
        check_workspace_access(workspace.id, clean_assignee_id, db)

    new_task = models.Task(
        title=task_data.title,
        description=task_data.description,
        status=task_data.status or "TODO",
        priority=task_data.priority or "MEDIUM",
        due_date=task_data.due_date,
        workspace_id=workspace.id,
        creator_id=current_user.id,
        assignee_id=clean_assignee_id
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # Ghi log lịch sử hoạt động Task & Workspace
    log_task_activity(
        db=db,
        task_id=new_task.id,
        user_id=current_user.id,
        action_type="TASK_CREATED",
        description=f"{current_user.username} đã tạo công việc '{new_task.title}'"
    )
    log_workspace_activity(
        workspace_id=workspace_id,
        user_id=current_user.id,
        action_type="TASK_CREATED",
        description=f"{current_user.username} đã tạo công việc '{new_task.title}'",
        db=db
    )

    return new_task


# 2. LẤY DANH SÁCH TASK TRONG WORKSPACE (Hỗ trợ lọc theo status, priority, assignee_id)
@router.get("/workspaces/{workspace_id}/tasks", response_model=list[schemas.TaskResponse])
def get_workspace_tasks(
    workspace_id: str,
    task_status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_workspace_access(workspace_id, current_user.id, db)

    query = db.query(models.Task).filter(models.Task.workspace_id == workspace_id)
    if task_status:
        query = query.filter(models.Task.status == task_status)
    if priority:
        query = query.filter(models.Task.priority == priority)
    if assignee_id:
        query = query.filter(models.Task.assignee_id == assignee_id)

    return query.all()


# 3. LẤY DANH SÁCH TASK ĐƯỢC GIAO CHO BẢN THÂN
@router.get("/tasks/me", response_model=list[schemas.TaskResponse])
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    tasks = db.query(models.Task).filter(models.Task.assignee_id == current_user.id).all()
    return tasks


# 4. XEM CHI TIẾT 1 TASK
@router.get("/tasks/{task_id}", response_model=schemas.TaskResponse)
def get_task_detail(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task không tồn tại!")
    check_workspace_access(task.workspace_id, current_user.id, db)
    return task


# 5. CẬP NHẬT TASK (Sửa thông tin / chuyển trạng thái / đổi người thực hiện)
@router.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: str,
    task_data: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task không tồn tại!")
    workspace = check_workspace_access(task.workspace_id, current_user.id, db)

    clean_uid = str(current_user.id).replace('#', '').strip()
    is_owner = (str(workspace.owner_id).replace('#', '').strip() == clean_uid)
    is_assignee = (task.assignee_id and str(task.assignee_id).replace('#', '').strip() == clean_uid)

    update_dict = task_data.dict(exclude_unset=True)

    # KIỂM TRA PHÂN QUYỀN CHẶT CHẼ: CHỈ OWNER MỚI ĐƯỢC THAO TÁC CÔNG VIỆC
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền chuyển trạng thái và thao tác công việc!"
        )

    if task_data.assignee_id is not None:
        if not task_data.assignee_id or str(task_data.assignee_id).lower() == "null":
            task_data.assignee_id = None
        else:
            task_data.assignee_id = str(task_data.assignee_id).replace('#', '').strip()
            check_workspace_access(task.workspace_id, task_data.assignee_id, db)

    # Ghi nhận các trường cũ để so sánh log hoạt động
    old_status = task.status
    old_assignee_id = task.assignee_id
    old_due_date = task.due_date
    # Cập nhật các trường được truyền lên
    for key, value in update_dict.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)

    # Tự động ghi log lịch sử
    if "status" in update_dict and update_dict["status"] != old_status:
        log_task_activity(
            db=db,
            task_id=task.id,
            user_id=current_user.id,
            action_type="STATUS_CHANGED",
            description=f"{current_user.username} đã chuyển trạng thái từ '{old_status}' sang '{task.status}'"
        )
        log_workspace_activity(
            workspace_id=task.workspace_id,
            user_id=current_user.id,
            action_type="STATUS_CHANGED",
            description=f"{current_user.username} đã chuyển trạng thái công việc '{task.title}' sang '{task.status}'",
            db=db
        )
    elif "assignee_id" in update_dict and update_dict["assignee_id"] != old_assignee_id:
        assignee_name = task.assignee.username if task.assignee else "Chưa gán"
        log_task_activity(
            db=db,
            task_id=task.id,
            user_id=current_user.id,
            action_type="ASSIGNEE_CHANGED",
            description=f"{current_user.username} đã đổi người thực hiện thành '{assignee_name}'"
        )
        log_workspace_activity(
            workspace_id=task.workspace_id,
            user_id=current_user.id,
            action_type="ASSIGNEE_CHANGED",
            description=f"{current_user.username} đã gán công việc '{task.title}' cho '{assignee_name}'",
            db=db
        )
    elif "due_date" in update_dict and update_dict["due_date"] != old_due_date:
        log_task_activity(
            db=db,
            task_id=task.id,
            user_id=current_user.id,
            action_type="DEADLINE_CHANGED",
            description=f"{current_user.username} đã thay đổi hạn chót của công việc"
        )
        log_workspace_activity(
            workspace_id=task.workspace_id,
            user_id=current_user.id,
            action_type="DEADLINE_CHANGED",
            description=f"{current_user.username} đã đổi hạn chót công việc '{task.title}'",
            db=db
        )
    elif update_dict:
        log_task_activity(
            db=db,
            task_id=task.id,
            user_id=current_user.id,
            action_type="TASK_UPDATED",
            description=f"{current_user.username} đã cập nhật thông tin công việc"
        )
        log_workspace_activity(
            workspace_id=task.workspace_id,
            user_id=current_user.id,
            action_type="TASK_UPDATED",
            description=f"{current_user.username} đã cập nhật công việc '{task.title}'",
            db=db
        )

    return task


# 6. XÓA TASK (Chỉ Workspace Owner mới được xóa)
@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task không tồn tại!")
    workspace = db.query(models.Workspace).filter(models.Workspace.id == task.workspace_id).first()
    clean_uid = str(current_user.id).replace('#', '').strip()
    is_owner = (workspace and str(workspace.owner_id).replace('#', '').strip() == clean_uid)
    if not is_owner:
        raise HTTPException(status_code=403, detail="Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền xóa công việc!")
    log_workspace_activity(
        workspace_id=task.workspace_id,
        user_id=current_user.id,
        action_type="TASK_DELETED",
        description=f"{current_user.username} đã xóa công việc '{task.title}'",
        db=db
    )
    db.delete(task)
    db.commit()
    return


# 7. KANBAN BOARD VIEW (Phục vụ giao diện bảng Kanban)
@router.get("/workspaces/{workspace_id}/kanban", response_model=schemas.KanbanBoardResponse)
def get_workspace_kanban(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_workspace_access(workspace_id, current_user.id, db)
    tasks = db.query(models.Task).filter(models.Task.workspace_id == workspace_id).all()

    return {
        "workspace_id": str(workspace_id),
        "todo": [t for t in tasks if t.status == "TODO"],
        "in_progress": [t for t in tasks if t.status == "IN_PROGRESS"],
        "review": [t for t in tasks if t.status == "REVIEW"],
        "done": [t for t in tasks if t.status == "DONE"],
        "cancelled": [t for t in tasks if t.status == "CANCELLED"]
    }


# 8. THỐNG KÊ TIẾN ĐỘ WORKSPACE (Phục vụ giao diện Dashboard / Summary)
@router.get("/workspaces/{workspace_id}/summary", response_model=schemas.WorkspaceSummaryResponse)
def get_workspace_summary(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_workspace_access(workspace_id, current_user.id, db)
    tasks = db.query(models.Task).filter(models.Task.workspace_id == workspace_id).all()

    total = len(tasks)
    todo = len([t for t in tasks if t.status == "TODO"])
    in_progress = len([t for t in tasks if t.status == "IN_PROGRESS"])
    review = len([t for t in tasks if t.status == "REVIEW"])
    done = len([t for t in tasks if t.status == "DONE"])
    cancelled = len([t for t in tasks if t.status == "CANCELLED"])
    completion_rate = round((done / total * 100), 2) if total > 0 else 0.0

    return {
        "workspace_id": str(workspace_id),
        "total_tasks": total,
        "todo_count": todo,
        "in_progress_count": in_progress,
        "review_count": review,
        "done_count": done,
        "cancelled_count": cancelled,
        "completion_rate": completion_rate
    }

