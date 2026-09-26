from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# 1. Schema cho dữ liệu người dùng gửi lên (Request)
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

# 2. Schema cho dữ liệu trả về (Response) - TUYỆT ĐỐI KHÔNG CÓ password
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True # Bắt buộc có để chuyển đổi dữ liệu từ SQLAlchemy sang Pydantic

# Dữ liệu client gửi lên khi Đăng nhập
class UserLogin(BaseModel):
    email: str
    password: str

# Dữ liệu Token trả về cho client
class Token(BaseModel):
    access_token: str
    token_type: str
# --- (MỚI) SCHEMA CHO WORKSPACE ---
# Dữ liệu client gửi lên khi tạo/sửa
class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None # Không bắt buộc nhập

# Dữ liệu trả về cho client
class WorkspaceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True
# --- (MỚI) SCHEMA CHO THÀNH VIÊN WORKSPACE ---
# Client chỉ cần gửi lên user_id muốn thêm
class WorkspaceMemberCreate(BaseModel):
    user_id: int

# Dữ liệu trả về
class WorkspaceMemberResponse(BaseModel):
    id: int
    workspace_id: int
    user_id: int
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True

# --- (MỚI) SCHEMAS CHO USER MỞ RỘNG ---
class UserUpdate(BaseModel):
    username:Optional[str]= None
    email: Optional[str]= None

class UserPasswordChange(BaseModel):
    old_password: str
    new_password: str

# --- (MỚI) SCHEMAS CHO TASK ---
class TaskCreate(BaseModel):
    title: str
    description: Optional[str]=None
    status: Optional[str]="TODO"
    priority: Optional[str]="MEDIUM"
    due_date: Optional[datetime]=None
    assignee_id: Optional[int]=None

class TaskUpdate(BaseModel):
    title: Optional[str]=None
    description: Optional[str]=None
    status: Optional[str]=None
    priority: Optional[str]=None
    due_date: Optional[datetime]=None
    assignee_id: Optional[str]=None

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[datetime]
    workspace_id: int
    creator_id: int
    assignee_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    creator: Optional[UserResponse]=None
    assignee: Optional[UserResponse]=None

    class Config:
        from_attributes=True