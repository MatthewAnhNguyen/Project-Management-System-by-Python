from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app import models, schemas
from app.database import get_db
from app.security import get_current_user, get_password_hash, verify_password

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=schemas.UserResponse)
def update_user_me(
    user_data: schemas.UserUpdate,
    db: Session=Depends(get_db),
    current_user: models.User=Depends(get_current_user)
):
    if user_data.username:
        existing_username=db.query(models.User).filter(
        models.User.username==user_data.username, models.User.id!=current_user.id).first()
        if existing_username:
            raise HTTPException(status_code=400,
            detail="Username này đã được sử dụng bởi người dùng khác!")
        current_user.username=user_data.username
    if user_data.email:
        existing_email=db.query(models.User).filter(
        models.User.email==user_data.email, models.User.id!=current_user.id).first()
        if existing_email:
            raise HTTPException(status_code=400,
            detail="Email này đã được sử dụng bởi người dùng khác!")
        current_user.email=user_data.email
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/me/password", status_code=status.HTTP_200_OK)
def change_password(
    pwd_data: schemas.UserPasswordChange,
    db: Session=Depends(get_db),
    current_user: models.User=Depends(get_current_user)
):
    if not verify_password(pwd_data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không chính xác!")
    current_user.password_hash=get_password_hash(pwd_data.new_password)

    db.commit()
    return {"message": "Đổi mật khẩu thành công!"}

@router.get("", response_model=list[schemas.UserResponse])
def search_users(
    q: str=None,
    db: Session=Depends(get_db),
    current_user: models.User=Depends(get_current_user)
):
    query= db.query(models.User)

    if q:
        q_trimmed = q.strip()
        clean_q = q_trimmed.replace('#', '').strip()
        conditions = [
            models.User.username.ilike(f"%{q_trimmed}%"),
            models.User.email.ilike(f"%{q_trimmed}%")
        ]
        conditions.append(models.User.id == clean_q)
        query = query.filter(or_(*conditions))
    return query.all()

@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    clean_id = user_id.replace('#', '').strip()
    user = db.query(models.User).filter(or_(models.User.id == user_id, models.User.id == clean_id)).first()

    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng!")

    return user