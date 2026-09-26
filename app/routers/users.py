from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app import models, schemas
from app.database import get_db
from app.security import get_current_user, get_password_hash, verify_password

router = APIRouter(prefix="/users", tags=["Users"])

# 1. LẤY THÔNG TIN CÁ NHÂN
@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# 2. CẬP NHẬT THÔNG TIN CÁ NHÂN (Username, Email)
@router.put("/me", response_model=schemas.UserResponse)
def update_user_me(
    user_data: schemas.UserUpdate,
    db: Session=Depends(get_db),
    current_user: models.User=Depends(get_current_user)
):
    # 1. Nếu người dùng nhập username mới -> Cập nhật username
    if user_data.username:
        existing_username=db.query(models.User).filter(
        models.User.username==user_data.username, models.User.id!=current_user.id).first()
        if existing_username:
            raise HTTPException(status_code=400,
            detail="Username này đã được sử dụng bởi người dùng khác!")
        current_user.username=user_data.username
    # 2. Nếu người dùng nhập email mới -> Kiểm tra trùng lặp trước khi cập nhật
    if user_data.email:
        existing_email=db.query(models.User).filter(
        models.User.email==user_data.email, models.User.id!=current_user.id).first()
        # Nếu email đã bị người khác dùng -> Ném ra lỗi 400
        if existing_email:
            raise HTTPException(status_code=400,
            detail="Email này đã được sử dụng bởi người dùng khác!")
        current_user.email=user_data.email
    db.commit() #Lưu thay đổi xuống Database
    db.refresh(current_user) #Cập nhật lại đối tượng current_user từ DB
    return current_user #Trả về thông tin user mới cập nhật

# 3. ĐỔI MẬT KHẨU CÁ NHÂN
@router.put("/me/password", status_code=status.HTTP_200_OK)
def change_password(
    pwd_data: schemas.UserPasswordChange,
    db: Session=Depends(get_db),
    current_user: models.User=Depends(get_current_user)
):
     # 1.Kiểm tra mật khẩu cũ người dùng nhập có khớp với mật khẩu đang lưu trong DB không
    if not verify_password(pwd_data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không chính xác!")
    # 2. Mã hóa (hash) mật khẩu mới trước khi lưu xuống DB
    current_user.password_hash=get_password_hash(pwd_data.new_password)

    db.commit()
    return {"message": "Đổi mật khẩu thành công!"}

# 4. TÌM KIẾM / DÀNH SÁCH NGƯỜI DÙNG (Để tìm member thêm vào Workspace)
@router.get("", response_model=list[schemas.UserResponse])
def search_users(
    q: str=None,
    db: Session=Depends(get_db),
    current_user: models.User=Depends(get_current_user)
):
    query= db.query(models.User)

    if q:
        query=query.filter(
            or_(
               models.User.username.ilike(f"%{q}%"),

               models.User.email.ilike(f"%{q}%")
            )
        )
    return query.all()

# 5. XEM PROFILE NGƯỜI DÙNG THEO ID
@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User=Depends(get_current_user)
):
    user=db.query(models.User).filter(models.User.id==user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng!")

    return user