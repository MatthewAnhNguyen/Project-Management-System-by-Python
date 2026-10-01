from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app import models, schemas
from app.database import get_db
from app.security import get_current_user

router = APIRouter(tags=["Task Comments & Collaboration"])


# Helper: Kiểm tra quyền truy cập vào Task thông qua Workspace
def check_task_access(task_id: int, user_id: int, db: Session):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task không tồn tại!")

    workspace = db.query(models.Workspace).filter(models.Workspace.id == task.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace không tồn tại!")

    is_owner = (workspace.owner_id == user_id)
    is_member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace.id,
        models.WorkspaceMember.user_id == user_id
    ).first()

    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập vào Task này!"
        )

    return task, workspace


# Helper: Tự động ghi lại lịch sử hoạt động của Task
def log_task_activity(db: Session, task_id: int, user_id: Optional[int], action_type: str, description: str):
    activity = models.TaskActivity(
        task_id=task_id,
        user_id=user_id,
        action_type=action_type,
        description=description
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


# 1. THÊM BÌNH LUẬN VÀO TASK
@router.post("/tasks/{task_id}/comments", response_model=schemas.CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    task_id: int,
    comment_data: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Kiểm tra quyền truy cập Task
    task, workspace = check_task_access(task_id, current_user.id, db)

    # 2. Kiểm tra nội dung comment
    content = comment_data.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nội dung bình luận không được để trống!"
        )

    # 3. Tạo comment mới
    new_comment = models.TaskComment(
        task_id=task_id,
        user_id=current_user.id,
        content=content
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    # 4. Tự động ghi log lịch sử hoạt động
    preview = content if len(content) <= 30 else content[:30] + "..."
    log_task_activity(
        db=db,
        task_id=task.id,
        user_id=current_user.id,
        action_type="COMMENT_ADDED",
        description=f"{current_user.username} đã bình luận: \"{preview}\""
    )

    return new_comment


# 2. XEM DANH SÁCH BÌNH LUẬN CỦA TASK
@router.get("/tasks/{task_id}/comments", response_model=list[schemas.CommentResponse])
def get_task_comments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_task_access(task_id, current_user.id, db)

    comments = db.query(models.TaskComment).filter(
        models.TaskComment.task_id == task_id
    ).order_by(models.TaskComment.created_at.asc()).all()

    return comments


# 3. XÓA BÌNH LUẬN
@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    comment = db.query(models.TaskComment).filter(models.TaskComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bình luận không tồn tại!")

    task, workspace = check_task_access(comment.task_id, current_user.id, db)

    # Chỉ người viết bình luận hoặc Chủ workspace mới được xóa
    is_author = (comment.user_id == current_user.id)
    is_owner = (workspace.owner_id == current_user.id)

    if not is_author and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn chỉ có quyền xóa bình luận của chính mình hoặc bạn phải là Chủ Workspace!"
        )

    task_id = comment.task_id
    db.delete(comment)
    db.commit()

    # Ghi log hoạt động
    log_task_activity(
        db=db,
        task_id=task_id,
        user_id=current_user.id,
        action_type="COMMENT_DELETED",
        description=f"{current_user.username} đã xóa một bình luận"
    )
    return


# 4. XEM LỊCH SỬ HOẠT ĐỘNG CỦA TASK (ACTIVITY LOG / AUDIT TRAIL)
@router.get("/tasks/{task_id}/activities", response_model=list[schemas.TaskActivityResponse])
def get_task_activities(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_task_access(task_id, current_user.id, db)

    activities = db.query(models.TaskActivity).filter(
        models.TaskActivity.task_id == task_id
    ).order_by(models.TaskActivity.created_at.desc()).all()

    return activities

