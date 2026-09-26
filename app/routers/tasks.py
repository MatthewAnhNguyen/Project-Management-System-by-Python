from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app import models, schemas
from app.database import get_db
from app.security import get_current_user

router = APIRouter(tags=["Tasks"])

# Hàm Helper kiểm tra xem user có phải là Owner hoặc Member của Workspace không
def check_workspace_access(workspace_id: int, user_id: int, db: Session):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại!")

    is_owner = (workspace.owner_id == user_id)
    is_member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == user_id
    ).first()

    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập Workspace này!")

    return workspace


# 1. TẠO TASK MỚI TRONG WORKSPACE
@router.post("/workspaces/{workspace_id}/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    workspace_id: int,
    task_data: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Kiểm tra quyền truy cập workspace
    check_workspace_access(workspace_id, current_user.id, db)

    # Nếu giao task cho 1 assignee, kiểm tra assignee có thuộc workspace không
    if task_data.assignee_id:
        check_workspace_access(workspace_id, task_data.assignee_id, db)

    new_task = models.Task(
        title=task_data.title,
        description=task_data.description,
        status=task_data.status or "TODO",
        priority=task_data.priority or "MEDIUM",
        due_date=task_data.due_date,
        workspace_id=workspace_id,
        creator_id=current_user.id,
        assignee_id=task_data.assignee_id
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


# 2. LẤY DANH SÁCH TASK TRONG WORKSPACE (Hỗ trợ lọc theo status, priority, assignee_id)
@router.get("/workspaces/{workspace_id}/tasks", response_model=list[schemas.TaskResponse])
def get_workspace_tasks(
    workspace_id: int,
    task_status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[int] = None,
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
    task_id: int,
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
    task_id: int,
    task_data: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task không tồn tại!")
    check_workspace_access(task.workspace_id, current_user.id, db)
    if task_data.assignee_id:
        check_workspace_access(task.workspace_id, task_data.assignee_id, db)

    # Cập nhật các trường được truyền lên
    update_dict = task_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


# 6. XÓA TASK (Chỉ Creator hoặc Workspace Owner mới được xóa)
@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task không tồn tại!")
    workspace = db.query(models.Workspace).filter(models.Workspace.id == task.workspace_id).first()
    is_creator = (task.creator_id == current_user.id)
    is_owner = (workspace and workspace.owner_id == current_user.id)
    if not is_creator and not is_owner:
        raise HTTPException(status_code=403, detail="Chỉ người tạo task hoặc Owner của Workspace mới được xóa task!")
    db.delete(task)
    db.commit()
    return
