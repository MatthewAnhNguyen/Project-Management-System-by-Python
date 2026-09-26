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

# API kiểm tra server
@app.get("/health", tags=["System"])
def health_check():
    return {"message": "Server is running perfectly"}