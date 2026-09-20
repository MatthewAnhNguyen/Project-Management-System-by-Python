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