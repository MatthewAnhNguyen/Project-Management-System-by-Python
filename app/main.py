import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base
# Import các router
from app.routers import auth, users, workspaces, tasks, comments, meetings

# Tạo database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Project Management System API",
    description="Backend chia theo Router chuẩn mực",
    version="1.0.0"
)

# --- CẤU HÌNH CORS CHO PHÉP FRONTEND GỌI API ---
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
app.include_router(comments.router)
app.include_router(meetings.router)

# --- PHỤC VỤ FILE TĨNH VÀ GIAO DIỆN FRONTEND ---
if os.path.exists("frontend/css"):
    app.mount("/css", StaticFiles(directory="frontend/css"), name="css")
if os.path.exists("frontend/js"):
    app.mount("/js", StaticFiles(directory="frontend/js"), name="js")

@app.get("/", tags=["Frontend"])
def serve_frontend():
    if os.path.exists("frontend/index.html"):
        return FileResponse("frontend/index.html")
    return {"message": "Project Management System API is running"}

# API kiểm tra server
@app.get("/health", tags=["System"])
def health_check():
    return {"message": "Server is running perfectly"}