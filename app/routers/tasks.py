from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app import models, schemas
from app.database import get_db
from app.security import get_current_user
from app.routers.workspaces import init_default_statuses_for_workspace

router = APIRouter(tags=["Tasks"])

# Hàm Helper kiểm tra xem user có phải là Owner hoặc Member của Workspace không
def check_workspace_access(workspace_id: str, user_id: str, db: Session):
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
    workspace_id: str,
    task_data: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Kiểm tra quyền truy cập workspace
    check_workspace_access(workspace_id, current_user.id, db)

    # Nếu giao task cho 1 assignee, kiểm tra assignee có thuộc workspace không
    if task_data.assignee_id:
        check_workspace_access(workspace_id, task_data.assignee_id, db)

    # Đảm bảo workspace đã có trạng thái khởi tạo
    init_default_statuses_for_workspace(workspace_id, db)

    status_name = "TODO"
    status_id_val = None

    if task_data.status_id is not None:
        status_obj = db.query(models.TaskStatus).filter(
            models.TaskStatus.id == task_data.status_id,
            models.TaskStatus.workspace_id == workspace_id
        ).first()
        if not status_obj:
            raise HTTPException(status_code=400, detail="Trạng thái (status_id) không tồn tại trong Workspace này!")
        status_name = status_obj.name
        status_id_val = status_obj.id
    elif task_data.status:
        clean_status = task_data.status.strip()
        status_obj = db.query(models.TaskStatus).filter(
            models.TaskStatus.workspace_id == workspace_id,
            func.lower(models.TaskStatus.name) == func.lower(clean_status)
        ).first()
        if not status_obj:
            raise HTTPException(
                status_code=400,
                detail=f"Trạng thái '{clean_status}' không tồn tại trong Workspace này! Owner của workspace có thể tạo thêm trạng thái."
            )
        status_name = status_obj.name
        status_id_val = status_obj.id
    else:
        # Lấy trạng thái đầu tiên theo order trong Workspace
        first_status = db.query(models.TaskStatus).filter(
            models.TaskStatus.workspace_id == workspace_id
        ).order_by(models.TaskStatus.order.asc(), models.TaskStatus.id.asc()).first()
        if first_status:
            status_name = first_status.name
            status_id_val = first_status.id

    new_task = models.Task(
        title=task_data.title,
        description=task_data.description,
        status=status_name,
        status_id=status_id_val,
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


# 2. LẤY DANH SÁCH TASK TRONG WORKSPACE (Hỗ trợ lọc theo trạng thái status, priority, assignee_id)
@router.get("/workspaces/{workspace_id}/tasks", response_model=list[schemas.TaskResponse])
def get_workspace_tasks(
    workspace_id: str,
    status: Optional[str] = Query(None, description="Lọc task theo tên trạng thái (ví dụ: TODO, DONE)"),
    task_status: Optional[str] = Query(None, description="Alias tương thích ngược cho status"),
    status_id: Optional[int] = Query(None, description="Lọc task theo ID trạng thái"),
    priority: Optional[str] = Query(None, description="Lọc task theo độ ưu tiên"),
    assignee_id: Optional[str] = Query(None, description="Lọc task theo ID người thực hiện"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_workspace_access(workspace_id, current_user.id, db)

    query = db.query(models.Task).filter(models.Task.workspace_id == workspace_id)

    # Chức năng lọc task theo trạng thái (status name hoặc status_id)
    filter_status = status or task_status
    if filter_status:
        query = query.filter(func.lower(models.Task.status) == filter_status.strip().lower())
    if status_id is not None:
        query = query.filter(models.Task.status_id == status_id)
    if priority:
        query = query.filter(func.lower(models.Task.priority) == priority.strip().lower())
    if assignee_id is not None:
        query = query.filter(models.Task.assignee_id == assignee_id)

    return query.all()


# 3. LẤY DANH SÁCH TASK ĐƯỢC GIAO CHO BẢN THÂN (Hỗ trợ lọc theo trạng thái)
@router.get("/tasks/me", response_model=list[schemas.TaskResponse])
def get_my_tasks(
    status: Optional[str] = Query(None, description="Lọc task theo tên trạng thái"),
    task_status: Optional[str] = Query(None, description="Alias tương thích ngược cho status"),
    status_id: Optional[int] = Query(None, description="Lọc task theo ID trạng thái"),
    priority: Optional[str] = Query(None, description="Lọc task theo mức độ ưu tiên"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Task).filter(models.Task.assignee_id == current_user.id)

    filter_status = status or task_status
    if filter_status:
        query = query.filter(func.lower(models.Task.status) == filter_status.strip().lower())
    if status_id is not None:
        query = query.filter(models.Task.status_id == status_id)
    if priority:
        query = query.filter(func.lower(models.Task.priority) == priority.strip().lower())

    return query.all()


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

    # Cập nhật trạng thái nếu có
    if task_data.status_id is not None:
        status_obj = db.query(models.TaskStatus).filter(
            models.TaskStatus.id == task_data.status_id,
            models.TaskStatus.workspace_id == task.workspace_id
        ).first()
        if not status_obj:
            raise HTTPException(status_code=400, detail="Trạng thái (status_id) không tồn tại trong Workspace này!")
        task.status_id = status_obj.id
        task.status = status_obj.name
    elif task_data.status is not None:
        init_default_statuses_for_workspace(task.workspace_id, db)
        clean_status = task_data.status.strip()
        status_obj = db.query(models.TaskStatus).filter(
            models.TaskStatus.workspace_id == task.workspace_id,
            func.lower(models.TaskStatus.name) == func.lower(clean_status)
        ).first()
        if not status_obj:
            raise HTTPException(
                status_code=400,
                detail=f"Trạng thái '{clean_status}' không tồn tại trong Workspace này! Owner của workspace có thể tạo thêm trạng thái."
            )
        task.status_id = status_obj.id
        task.status = status_obj.name

    # Cập nhật các trường còn lại
    update_dict = task_data.dict(exclude_unset=True)
    update_dict.pop("status", None)
    update_dict.pop("status_id", None)
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
