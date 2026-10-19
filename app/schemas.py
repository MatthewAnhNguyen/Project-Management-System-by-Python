from pydantic import BaseModel, field_validator
from datetime import datetime, timezone
from typing import Optional, Union

# 1. Schema cho dữ liệu người dùng gửi lên (Request)
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

# 2. Schema cho dữ liệu trả về (Response) - TUYỆT ĐỐI KHÔNG CÓ password
class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True # Bắt buộc có để chuyển đổi dữ liệu từ SQLAlchemy sang Pydantic

    @field_validator('created_at', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

class UserSimpleResponse(BaseModel):
    id: str
    username: str
    email: str

    class Config:
        from_attributes = True

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
    id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    created_at: datetime
    total_tasks: Optional[int] = 0
    done_tasks: Optional[int] = 0
    completion_rate: Optional[float] = 0.0

    class Config:
        from_attributes = True
# --- (MỚI) SCHEMA CHO THÀNH VIÊN WORKSPACE ---
# Client có thể gửi lên user_id (chuỗi ID ngẫu nhiên) hoặc username/email
class WorkspaceMemberCreate(BaseModel):
    user_id: str


# Dữ liệu trả về
class WorkspaceMemberResponse(BaseModel):
    id: int
    workspace_id: str
    user_id: str
    role: str
    joined_at: datetime
    user: Optional[UserSimpleResponse] = None

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
    assignee_id: Optional[str]=None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[str] = None

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[datetime]
    workspace_id: str
    creator_id: str
    assignee_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    creator: Optional[UserResponse] = None
    assignee: Optional[UserResponse] = None

    class Config:
        from_attributes = True

    @field_validator('due_date', 'created_at', 'updated_at', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

# --- (MỚI) SCHEMAS CHO BÌNH LUẬN (COMMENTS) ---
class CommentCreate(BaseModel):
    content: str

class CommentResponse(BaseModel):
    id: int
    task_id: int
    user_id: str
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    user: Optional[UserSimpleResponse] = None

    class Config:
        from_attributes = True

# --- (MỚI) SCHEMAS CHO LỊCH SỬ HOẠT ĐỘNG (ACTIVITIES) ---
class TaskActivityResponse(BaseModel):
    id: int
    task_id: int
    user_id: Optional[str] = None
    action_type: str
    description: str
    created_at: datetime
    user: Optional[UserSimpleResponse] = None

    class Config:
        from_attributes = True


# --- (MỚI) SCHEMAS PHỤC VỤ GIAO DIỆN TASK UI / KANBAN / SUMMARY ---
class KanbanBoardResponse(BaseModel):
    workspace_id: str
    todo: list[TaskResponse] = []
    in_progress: list[TaskResponse] = []
    review: list[TaskResponse] = []
    done: list[TaskResponse] = []
    cancelled: list[TaskResponse] = []

class WorkspaceSummaryResponse(BaseModel):
    workspace_id: str
    total_tasks: int
    todo_count: int
    in_progress_count: int
    review_count: int = 0
    done_count: int
    cancelled_count: int
    completion_rate: float

# --- SCHEMAS Phục vụ cho MEETING
class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    meeting_link: Optional[str] = None
    start_time: datetime
    end_time: datetime
    task_id: Optional[int] = None

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    meeting_link: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class MeetingResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    meeting_link: Optional[str]
    start_time: datetime
    end_time: datetime
    workspace_id: str
    creator_id: str
    task_id: Optional[int]
    created_at: datetime
    creator: Optional[UserSimpleResponse] = None

    class Config:
        from_attributes = True

    @field_validator('start_time', 'end_time', 'created_at', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

class WorkspaceActivityResponse(BaseModel):
    id: int
    workspace_id: str
    user_id: Optional[str] = None
    action_type: str
    description: str
    created_at: datetime
    user: Optional[UserSimpleResponse] = None

    class Config:
        from_attributes = True

class CalendarEventResponse(BaseModel):
    id: str
    title: str
    start_time: datetime
    end_time: Optional[datetime] = None
    event_type: str

    description: Optional[str] = None
    meeting_link: Optional[str] = None
    task_status: Optional[str] = None
    task_priority: Optional[str] = None
    assignee_name: Optional[str] = None
    creator_name: Optional[str] = None
    workspace_id: Optional[str] = None

    class Config:
        from_attributes = True

    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v