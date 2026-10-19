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

# Helper
def log_workspace_activity(
        workspace_id: str,
        user_id: str,
        action_type: str,
        description: str,
        db: Session
):
    activity = models.WorkspaceActivity(
        workspace_id=workspace_id,
        user_id=user_id,
        action_type=action_type,
        description=description
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity
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

    # Tính toán tiến trình động cho từng workspace
    for ws in workspaces:
        total = db.query(models.Task).filter(models.Task.workspace_id == str(ws.id)).count()
        done = db.query(models.Task).filter(
            models.Task.workspace_id == str(ws.id),
            models.Task.status == "DONE"
        ).count()
        ws.total_tasks = total
        ws.done_tasks = done
        ws.completion_rate = round((done / total * 100), 1) if total > 0 else 0.0

    return workspaces


# 3. XEM CHI TIẾT 1 WORKSPACE (Owner và Member đều xem được)
@router.get("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def get_workspace(workspace_id: str, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    clean_id = str(workspace_id).replace('#', '').strip()
    workspace = db.query(models.Workspace).filter(
        or_(models.Workspace.id == workspace_id, models.Workspace.id == clean_id)
    ).first()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại")

    # Kiểm tra quyền: Cho phép cả Owner lẫn Member xem thông tin
    is_owner = (str(workspace.owner_id) == str(current_user.id))
    is_member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == str(workspace.id),
        models.WorkspaceMember.user_id == str(current_user.id)
    ).first()

    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập Workspace này")

    # Tính toán tiến trình động
    total = db.query(models.Task).filter(models.Task.workspace_id == str(workspace.id)).count()
    done = db.query(models.Task).filter(
        models.Task.workspace_id == str(workspace.id),
        models.Task.status == "DONE"
    ).count()
    workspace.total_tasks = total
    workspace.done_tasks = done
    workspace.completion_rate = round((done / total * 100), 1) if total > 0 else 0.0

    return workspace


# 4. SỬA WORKSPACE (Chỉ Owner)
@router.put("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def update_workspace(workspace_id: str, update_data: schemas.WorkspaceCreate, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại")

    # Kiểm tra quyền: Chỉ Owner mới được sửa
    if str(workspace.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Chỉ Owner mới được quyền sửa Workspace")

    # Cập nhật thông tin
    workspace.name = update_data.name
    workspace.description = update_data.description
    db.commit()
    db.refresh(workspace)
    return workspace


# 5. XÓA WORKSPACE (Chỉ Owner)
@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(workspace_id: str, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại")

    # Kiểm tra quyền: Chỉ Owner mới được xóa
    if str(workspace.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Chỉ Owner mới được quyền xóa Workspace")

    db.delete(workspace)
    db.commit()
    return  # Xóa xong không cần trả về gì (Status 204)


# 1. THÊM THÀNH VIÊN VÀO WORKSPACE (Chỉ Owner)
@router.post("/{workspace_id}/members", response_model=schemas.WorkspaceMemberResponse,
          status_code=status.HTTP_201_CREATED)
def add_workspace_member(workspace_id: str, member_data: schemas.WorkspaceMemberCreate, db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):
    # B1: Kiểm tra Workspace có tồn tại không (404)
    clean_id = str(workspace_id).replace('#', '').strip()
    workspace = db.query(models.Workspace).filter(
        or_(models.Workspace.id == workspace_id, models.Workspace.id == clean_id)
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại!")

    # B2: Kiểm tra quyền - Chỉ Owner mới được thêm người (403)
    if str(workspace.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Chỉ Chủ sở hữu (Owner) mới có quyền thêm thành viên!")

    # B3: Tìm User muốn thêm bằng ID, Username hoặc Email
    raw_val = str(member_data.user_id).strip()
    clean_val = raw_val.replace('#', '').strip()
    target_user = db.query(models.User).filter(
        or_(models.User.id == clean_val, models.User.id == raw_val)
    ).first()

    if not target_user:
        target_user = db.query(models.User).filter(
            or_(
                models.User.username.ilike(raw_val),
                models.User.email.ilike(raw_val)
            )
        ).first()

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy người dùng với thông tin: '{raw_val}'. Vui lòng kiểm tra lại User ID hoặc Email!"
        )

    # B4: Kiểm tra xem User đó đã là thành viên chưa hoặc có phải chính là Owner không (409)
    if str(target_user.id) == str(workspace.owner_id):
        raise HTTPException(
            status_code=409,
            detail=f"Người dùng {target_user.username} (ID: #{target_user.id}) chính là Chủ dự án (Owner)!"
        )

    existing_member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == str(workspace.id),
        models.WorkspaceMember.user_id == target_user.id
    ).first()
    if existing_member:
        raise HTTPException(
            status_code=409,
            detail=f"Người dùng {target_user.username} (ID: #{target_user.id}) đã là thành viên của dự án!"
        )

    # B5: Thỏa mãn hết điều kiện -> Lưu vào DB
    new_member = models.WorkspaceMember(
        workspace_id=workspace.id,
        user_id=target_user.id,
        role="MEMBER"
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    new_member.user = target_user

    log_workspace_activity(
        workspace_id=workspace.id,
        user_id=current_user.id,
        action_type="MEMBER_ADDED",
        description=f"{current_user.username} đã thêm {target_user.username} (ID: #{target_user.id}) vào Workspace",
        db=db
    )
    return new_member


# 2. XEM DANH SÁCH THÀNH VIÊN (Owner và Member đều xem được)
@router.get("/{workspace_id}/members", response_model=list[schemas.WorkspaceMemberResponse])
def get_workspace_members(workspace_id: str, db: Session = Depends(get_db),
                          current_user: models.User = Depends(get_current_user)):
    clean_id = str(workspace_id).replace('#', '').strip()
    workspace = db.query(models.Workspace).filter(
        or_(models.Workspace.id == workspace_id, models.Workspace.id == clean_id)
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại!")

    # Kiểm tra quyền: Phải là Owner hoặc đang là Member thì mới được xem
    is_owner = (str(workspace.owner_id) == str(current_user.id))
    is_member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == str(workspace.id),
        models.WorkspaceMember.user_id == str(current_user.id)
    ).first()

    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem danh sách này!")

    # Trả về danh sách thành viên thực tế
    members = db.query(models.WorkspaceMember).filter(models.WorkspaceMember.workspace_id == str(workspace.id)).all()

    # Kiểm tra xem Owner đã có trong danh sách thành viên chưa, nếu chưa thì thêm vào đầu danh sách
    has_owner = any(str(m.user_id) == str(workspace.owner_id) for m in members)
    if not has_owner:
        owner_user = db.query(models.User).filter(models.User.id == workspace.owner_id).first()
        owner_member = models.WorkspaceMember(
            id=0,
            workspace_id=workspace.id,
            user_id=workspace.owner_id,
            role="OWNER",
            joined_at=workspace.created_at
        )
        owner_member.user = owner_user
        return [owner_member] + list(members)

    return members


# 3. XÓA THÀNH VIÊN KHỎI WORKSPACE (Chỉ Owner)
@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_workspace_member(workspace_id: str, user_id: str, db: Session = Depends(get_db),
                            current_user: models.User = Depends(get_current_user)):
    clean_id = str(workspace_id).replace('#', '').strip()
    workspace = db.query(models.Workspace).filter(
        or_(models.Workspace.id == workspace_id, models.Workspace.id == clean_id)
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại!")

    # Kiểm tra quyền
    if str(workspace.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Chỉ Owner mới có quyền xóa thành viên!")

    # Tìm record thành viên
    clean_user_id = str(user_id).replace('#', '').strip()
    member_to_remove = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == str(workspace.id),
        or_(models.WorkspaceMember.user_id == clean_user_id, models.WorkspaceMember.user_id == str(user_id))
    ).first()

    if not member_to_remove:
        raise HTTPException(status_code=404, detail="Người dùng không phải là thành viên của Workspace này!")

    # Xóa khỏi DB
    db.delete(member_to_remove)
    db.commit()
    log_workspace_activity(
        workspace_id=workspace.id,
        user_id=current_user.id,
        action_type="MEMBER_REMOVED",
        description=f"{current_user.username} đã xóa một thành viên khỏi Workspace",
        db=db
    )
    return


# 4. JOIN VÀO WORKSPACE BẰNG ID
@router.post("/{workspace_id}/join", response_model=schemas.WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
def join_workspace_by_id(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    clean_id = str(workspace_id).replace('#', '').strip()
    workspace = db.query(models.Workspace).filter(
        or_(models.Workspace.id == workspace_id, models.Workspace.id == clean_id)
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy dự án với ID: {workspace_id}")

    # Nếu người dùng chính là Chủ sở hữu (Owner) của Workspace
    if str(workspace.owner_id) == str(current_user.id):
        return models.WorkspaceMember(
            id=0,
            workspace_id=workspace.id,
            user_id=current_user.id,
            role="OWNER",
            joined_at=workspace.created_at
        )

    # Nếu người dùng đã là thành viên rồi
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == str(workspace.id),
        models.WorkspaceMember.user_id == str(current_user.id)
    ).first()
    if member:
        return member

    new_member = models.WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role="MEMBER"
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    log_workspace_activity(
        workspace_id=workspace.id,
        user_id=current_user.id,
        action_type="MEMBER_JOINED",
        description=f"{current_user.username} đã tham gia vào Workspace",
        db=db
    )
    return new_member


# 5. LẤY DANH SÁCH NHẬT KÝ HOẠT ĐỘNG CỦA WORKSPACE (Chỉ Chủ dự án - Owner)
@router.get("/{workspace_id}/activities", response_model=list[schemas.WorkspaceActivityResponse], status_code=status.HTTP_200_OK)
def get_workspace_activities(
        workspace_id: str,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
):
    clean_id = str(workspace_id).replace('#', '').strip()
    workspace = db.query(models.Workspace).filter(
        or_(models.Workspace.id == workspace_id, models.Workspace.id == clean_id)
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại")

    is_owner = (str(workspace.owner_id) == str(current_user.id))
    if not is_owner:
        raise HTTPException(status_code=403, detail="Chỉ chủ sở hữu (Owner) của dự án mới có quyền xem nhật ký hoạt động!")

    activities = db.query(models.WorkspaceActivity).filter(
        models.WorkspaceActivity.workspace_id == str(workspace.id)
    ).order_by(models.WorkspaceActivity.created_at.desc()).all()
    return activities

