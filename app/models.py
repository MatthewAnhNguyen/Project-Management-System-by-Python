import secrets
import string
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from .database import Base
from sqlalchemy.orm import relationship


def generate_random_id(length: int = 12) -> str:
    # Sinh ngẫu nhiên dãy gồm chữ cái và chữ số không trùng lặp
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, default=generate_random_id, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="member")  # VD: admin, manager, member

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    workspaces_owned = relationship("Workspace", back_populates="owner")


# --- BẢNG WORKSPACE ---
class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(50), primary_key=True, default=generate_random_id, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)

    # Khóa ngoại liên kết với id dạng chuỗi của bảng users
    owner_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    owner = relationship("User", back_populates="workspaces_owned")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="workspace", cascade="all, delete-orphan")
    statuses = relationship("TaskStatus", back_populates="workspace", cascade="all, delete-orphan", order_by="TaskStatus.order")


# --- BẢNG WORKSPACE MEMBERS ---
class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    id = Column(Integer, primary_key=True, index=True)

    workspace_id = Column(String(50), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    role = Column(String(20), default="MEMBER")
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User")


# --- BẢNG TRẠNG THÁI TASK CỦA WORKSPACE ---
class TaskStatus(Base):
    __tablename__ = "task_statuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    color = Column(String(20), nullable=True)  # VD: #718096, #3182ce, #38a169
    order = Column(Integer, default=0)         # Thứ tự sắp xếp cột/trạng thái

    workspace_id = Column(String(50), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace = relationship("Workspace", back_populates="statuses")
    tasks = relationship("Task", back_populates="task_status", passive_deletes=True)


# --- BẢNG TASK ---
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    status = Column(String(50), default="TODO", nullable=False)
    status_id = Column(Integer, ForeignKey("task_statuses.id", ondelete="SET NULL"), nullable=True)
    priority = Column(String(20), default="MEDIUM")
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Khóa ngoại liên kết Workspace và Users dạng chuỗi chữ và số
    workspace_id = Column(String(50), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    creator_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assignee_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="tasks")
    creator = relationship("User", foreign_keys=[creator_id])
    assignee = relationship("User", foreign_keys=[assignee_id])
    task_status = relationship("TaskStatus", back_populates="tasks")