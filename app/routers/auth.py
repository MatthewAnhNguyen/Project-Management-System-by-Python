from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import get_password_hash, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    email_clean = user.email.strip().lower()
    username_clean = user.username.strip()

    db_user = db.query(models.User).filter(models.User.email == email_clean).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{email_clean}' đã được đăng ký! Vui lòng chuyển sang tab Đăng nhập."
        )

    final_username = username_clean
    existing_user = db.query(models.User).filter(models.User.username == final_username).first()
    counter = 1
    while existing_user:
        final_username = f"{username_clean} ({counter})"
        existing_user = db.query(models.User).filter(models.User.username == final_username).first()
        counter += 1

    hashed_password = get_password_hash(user.password)

    new_user = models.User(
        username=final_username,
        email=email_clean,
        password_hash=hashed_password,
        created_at=datetime.now(timezone.utc)
    )
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lỗi khi lưu tài khoản: {str(e)}"
        )

    return new_user


@router.post("/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()

    if not user or not verify_password(user_credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác!"
        )

    access_token = create_access_token(data={"user_id": user.id})

    return {"access_token": access_token, "token_type": "bearer"}