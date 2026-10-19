from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
# Nhớ import các hàm bảo mật từ file security.py
from app.security import get_password_hash, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    email_clean = user.email.strip().lower()
    username_clean = user.username.strip()

    # 1. Kiểm tra email đã đăng ký chưa
    db_user = db.query(models.User).filter(models.User.email == email_clean).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{email_clean}' đã được đăng ký! Vui lòng chuyển sang tab Đăng nhập."
        )

    # 2. Xử lý username (Họ và tên) tránh lỗi SQLite UNIQUE constraint nếu trùng Họ và tên
    final_username = username_clean
    existing_user = db.query(models.User).filter(models.User.username == final_username).first()
    counter = 1
    while existing_user:
        final_username = f"{username_clean} ({counter})"
        existing_user = db.query(models.User).filter(models.User.username == final_username).first()
        counter += 1

    # 3. Hash password
    hashed_password = get_password_hash(user.password)

    # 4. Lưu vào DB
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


# --- ĐÂY LÀ PHẦN CODE LOGIN BẠN CẦN THÊM VÀO ---
@router.post("/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    # 1. Tìm user trong DB theo email
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()

    # 2. Kiểm tra email có tồn tại và password có đúng không
    if not user or not verify_password(user_credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác!"
        )

    # 3. Nếu đúng, tạo JWT token chứa user_id
    access_token = create_access_token(data={"user_id": user.id})

    # 4. Trả token về cho client (Bắt buộc phải có lệnh return này)
    return {"access_token": access_token, "token_type": "bearer"}