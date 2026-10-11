import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from app.database import engine, Base

# Import các router
from app.routers import auth, users, workspaces, tasks

# Tạo database an toàn (tránh sập app khi bảng cũ bị xung đột kiểu khóa ngoại)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"\n[CẢNH BÁO DATABASE] Không thể tự động tạo bảng: {e}")
    print("[HƯỚNG DẪN KHẮC PHỤC] Schema đã đổi sang ID chuỗi. Vui lòng chạy lệnh: python seed_db.py để dọn dẹp và nạp dữ liệu mẫu!\n")

app = FastAPI(
    title="Project Management System API",
    description="Backend chia theo Router chuẩn mực",
    version="1.0.0"
)

# --- CẤU HÌNH CORS CHO PHÉP WEB GỌI API AN TOÀN ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GẮN CÁC ROUTER VÀO APP CHÍNH ---
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(workspaces.router)
app.include_router(tasks.router)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
STATIC_INDEX = os.path.join(STATIC_DIR, "index.html")

# API kiểm tra server
@app.get("/health", tags=["System"])
def health_check():
    return {"message": "Server is running perfectly"}

# Web giao diện trực quan hoàn chỉnh để xem và test hệ thống
@app.get("/", response_class=HTMLResponse, tags=["Web UI"])
def index_page():
    if os.path.exists(STATIC_INDEX):
        with open(STATIC_INDEX, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h3>Chưa tìm thấy file app/static/index.html</h3>")