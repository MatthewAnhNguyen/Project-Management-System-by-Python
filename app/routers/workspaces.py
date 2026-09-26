from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app import models, schemas
from app.database import get_db
from app.security import get_current_user

router = APIRouter(prefix="/workspaces", tags=["Workspaces & Members"])

# Gắn 5 API của Workspace (Create, Get All, Get Detail, Update, Delete) vào đây
# Gắn 3 API của Members vào đây luôn
# Đổi @app.post thành @router.post, đường dẫn không cần ghi /workspaces ở đầu nữa (VD: @router.post(""))
# ... (Copy các hàm cũ sang) ...
# 1. TẠO WORKSPACE
@router.post("", response_model=schemas.WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(workspace: schemas.WorkspaceCreate, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    # Tạo workspace mới, gán owner_id chính là id của người đang đăng nhập
    new_workspace = models.Workspace(
        name=workspace.name,
        description=workspace.description,
        owner_id=current_user.id
    )
    db.add(new_workspace)
    db.commit()
    db.refresh(new_workspace)
    return new_workspace


# 2. LẤY DANH SÁCH WORKSPACE CỦA MÌNH
@router.get("", response_model=list[schemas.WorkspaceResponse])
def get_workspaces(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Lấy Workspace mình là Owner HOẶC mình là Member
    workspaces = db.query(models.Workspace).outerjoin(
        models.WorkspaceMember,
        models.Workspace.id == models.WorkspaceMember.workspace_id
    ).filter(
        or_(
            models.Workspace.owner_id == current_user.id,
            models.WorkspaceMember.user_id == current_user.id
        )
    ).distinct().all() # distinct() để loại bỏ các kết quả bị trùng lặp

    return workspaces


# 3. XEM CHI TIẾT 1 WORKSPACE
@router.get("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def get_workspace(workspace_id: int, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại")

    # Kiểm tra quyền: Chỉ cho xem nếu mình là owner (sau này sẽ mở rộng cho member)
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập Workspace này")

    return workspace


# 4. SỬA WORKSPACE (Chỉ Owner)
@router.put("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def update_workspace(workspace_id: int, update_data: schemas.WorkspaceCreate, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại")

    # Kiểm tra quyền: Chỉ Owner mới được sửa
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Chỉ Owner mới được quyền sửa Workspace")

    # Cập nhật thông tin
    workspace.name = update_data.name
    workspace.description = update_data.description
    db.commit()
    db.refresh(workspace)
    return workspace


# 5. XÓA WORKSPACE (Chỉ Owner)
@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(workspace_id: int, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại")

    # Kiểm tra quyền: Chỉ Owner mới được xóa
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Chỉ Owner mới được quyền xóa Workspace")

    db.delete(workspace)
    db.commit()
    return  # Xóa xong không cần trả về gì (Status 204)


# 1. THÊM THÀNH VIÊN VÀO WORKSPACE (Chỉ Owner)
@router.post("/{workspace_id}/members", response_model=schemas.WorkspaceMemberResponse,
          status_code=status.HTTP_201_CREATED)
def add_workspace_member(workspace_id: int, member_data: schemas.WorkspaceMemberCreate, db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):
    # B1: Kiểm tra Workspace có tồn tại không (404)
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại!")

    # B2: Kiểm tra quyền - Chỉ Owner mới được thêm người (403)
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Chỉ Owner mới có quyền thêm thành viên!")

    # B3: Kiểm tra User muốn thêm có thực sự tồn tại trong hệ thống không (404)
    target_user = db.query(models.User).filter(models.User.id == member_data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Người dùng không tồn tại!")

    # B4: Kiểm tra xem User đó đã là thành viên chưa hoặc có phải chính là Owner không (409)
    if member_data.user_id == workspace.owner_id:
        raise HTTPException(status_code=409, detail="User này là Owner của Workspace rồi!")

    existing_member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == member_data.user_id
    ).first()
    if existing_member:
        raise HTTPException(status_code=409, detail="Người dùng này đã là thành viên của Workspace!")

    # B5: Thỏa mãn hết điều kiện -> Lưu vào DB
    new_member = models.WorkspaceMember(
        workspace_id=workspace_id,
        user_id=member_data.user_id,
        role="MEMBER"
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member


# 2. XEM DANH SÁCH THÀNH VIÊN (Owner và Member đều xem được)
@router.get("/{workspace_id}/members", response_model=list[schemas.WorkspaceMemberResponse])
def get_workspace_members(workspace_id: int, db: Session = Depends(get_db),
                          current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại!")

    # Kiểm tra quyền: Phải là Owner hoặc đang là Member thì mới được xem
    is_owner = (workspace.owner_id == current_user.id)
    is_member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == current_user.id
    ).first()

    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem danh sách này!")

    # Trả về danh sách
    members = db.query(models.WorkspaceMember).filter(models.WorkspaceMember.workspace_id == workspace_id).all()
    return members


# 3. XÓA THÀNH VIÊN KHỎI WORKSPACE (Chỉ Owner)
@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_workspace_member(workspace_id: int, user_id: int, db: Session = Depends(get_db),
                            current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại!")

    # Kiểm tra quyền
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Chỉ Owner mới có quyền xóa thành viên!")

    # Tìm record thành viên
    member_to_remove = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == user_id
    ).first()

    if not member_to_remove:
        raise HTTPException(status_code=404, detail="Người dùng không phải là thành viên của Workspace này!")

    # Xóa khỏi DB
    db.delete(member_to_remove)
    db.commit()
    return