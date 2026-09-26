from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from .database import Base
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"  # Tên bảng trong MySQL

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="member")  # VD: admin, manager, member

    # Hàm func.now() sẽ lấy thời gian hiện tại của database khi tạo user
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    workspaces_owned = relationship("Workspace", back_populates="owner")


# --- (MỚI) BẢNG WORKSPACE ---
class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)  # Có thể để trống

    # Khóa ngoại liên kết với id của bảng users
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    owner = relationship("User", back_populates="workspaces_owned")
    # Tự động load danh sách thành viên: workspace.members
    members = relationship("WorkspaceMember", back_populates="workspace")
    #Một Workspace có thể chứa nhiều Task
    tasks=relationship("Task", back_populates="workspace", cascade="all, delete-orphan")


# --- (MỚI) BẢNG WORKSPACE MEMBERS ---
class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    id = Column(Integer, primary_key=True, index=True)

    # THÊM ondelete="CASCADE" vào đây
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    role = Column(String(20), default="MEMBER")
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User")

# --- (MỚI) BẢNG TASK ---
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    # Trạng thái công việc: TODO, IN_PROGRESS, DONE, CANCELLED
    status = Column(String(20), default="TODO")
    # Mức độ ưu tiên: LOW, MEDIUM, HIGH, URGENT
    priority = Column(String(20), default="MEDIUM")
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Khóa ngoại liên kết Workspace và Users
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Quan hệ ORM
    workspace = relationship("Workspace", back_populates="tasks")
    creator = relationship("User", foreign_keys=[creator_id])
    assignee = relationship("User", foreign_keys=[assignee_id])