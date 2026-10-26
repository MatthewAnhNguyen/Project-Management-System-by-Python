import secrets
import string
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from .database import Base
from sqlalchemy.orm import relationship

def generate_random_id(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))

class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, default=generate_random_id, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="member")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())
    workspaces_owned = relationship("Workspace", back_populates="owner")
    comments = relationship("TaskComment", back_populates="user")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(50), primary_key=True, default=generate_random_id, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)

    owner_id = Column(String(50), ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    owner = relationship("User", back_populates="workspaces_owned")
    members = relationship("WorkspaceMember", back_populates="workspace")
    tasks=relationship("Task", back_populates="workspace", cascade="all, delete-orphan")
    meetings=relationship("Meeting", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    id = Column(Integer, primary_key=True, index=True)

    workspace_id = Column(String(50), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    role = Column(String(20), default="MEMBER")
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    status = Column(String(20), default="TODO")
    priority = Column(String(20), default="MEDIUM")
    due_date = Column(DateTime(timezone=True), nullable=True)

    workspace_id = Column(String(50), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    creator_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assignee_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="tasks")
    creator = relationship("User", foreign_keys=[creator_id])
    assignee = relationship("User", foreign_keys=[assignee_id])
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    activities = relationship("TaskActivity", back_populates="task", cascade="all, delete-orphan")


class TaskComment(Base):
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    task = relationship("Task", back_populates="comments")
    user = relationship("User", back_populates="comments")


class TaskActivity(Base):
    __tablename__ = "task_activities"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", back_populates="activities")
    user = relationship("User")

class Meeting(Base):
    __tablename__="meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    meeting_link = Column(String(255), nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)

    workspace_id = Column(String(50), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    creator_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable = True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    workspace = relationship("Workspace", back_populates="meetings")
    creator = relationship("User")
    task = relationship("Task")

class WorkspaceActivity(Base):
    __tablename__ = "workspace_activities"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(50), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    workspace = relationship("Workspace")
    user = relationship("User")

