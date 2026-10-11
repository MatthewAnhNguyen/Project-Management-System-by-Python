from fastapi import FastAPI
from app.database import engine, Base

# Import các router
from app.routers import auth, users, workspaces, tasks

# Tạo database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Project Management System API",
    description="Backend chia theo Router chuẩn mực",
    version="1.0.0"
)

# --- GẮN CÁC ROUTER VÀO APP CHÍNH ---
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(workspaces.router)
app.include_router(tasks.router)

import os
from fastapi.responses import FileResponse

STATIC_INDEX = os.path.join(os.path.dirname(__file__), "static", "index.html")

# API kiểm tra server
@app.get("/health", tags=["System"])
def health_check():
    return {"message": "Server is running perfectly"}

# Web giao diện trực quan hoàn chỉnh để xem và test hệ thống
@app.get("/", response_class=FileResponse, tags=["Web UI"])
def index_page():
    return FileResponse(STATIC_INDEX)