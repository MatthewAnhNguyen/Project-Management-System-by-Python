import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Đọc các biến môi trường từ file .env
load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Khởi tạo Engine (Động cơ kết nối với MySQL)
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Tạo Session để sau này thực hiện thêm/sửa/xoá/đọc dữ liệu
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Class gốc để các Model (Bảng) kế thừa
Base = declarative_base()

# Thêm hàm này vào cuối file database.py
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()