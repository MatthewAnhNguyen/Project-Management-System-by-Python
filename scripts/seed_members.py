import sys
from datetime import datetime, timezone
from app.database import SessionLocal
from app import models
from app.security import get_password_hash
from app.routers.workspaces import log_workspace_activity

def seed():
    sys.stdout.reconfigure(encoding='utf-8')
    db = SessionLocal()

    # 1. Tìm workspace 'lập trình web'
    ws = db.query(models.Workspace).filter(models.Workspace.id == '8o99jrSZTPEf').first()
    if not ws:
        ws = db.query(models.Workspace).first()

    if not ws:
        print("Không tìm thấy workspace nào trong cơ sở dữ liệu!")
        return

    print(f"Target Workspace: {ws.id} - {ws.name} (Owner: {ws.owner_id})")
    owner = db.query(models.User).filter(models.User.id == ws.owner_id).first()
    owner_name = owner.username if owner else "Chủ dự án"

    # 2. Danh sách 6 thành viên mới mẫu
    sample_members = [
        {"username": "Trần Thị Mai", "email": "mai.tran@gmail.com"},
        {"username": "Lê Hoàng Nam", "email": "nam.le@gmail.com"},
        {"username": "Phạm Minh Đức", "email": "duc.pham@gmail.com"},
        {"username": "Vũ Thùy Linh", "email": "linh.vu@gmail.com"},
        {"username": "Đỗ Quang Huy", "email": "huy.do@gmail.com"},
        {"username": "Bùi Phương Thảo", "email": "thao.bui@gmail.com"},
    ]

    default_pw_hash = get_password_hash("123456")
    created_users = []

    for m in sample_members:
        user = db.query(models.User).filter(models.User.email == m["email"]).first()
        if not user:
            user = models.User(
                username=m["username"],
                email=m["email"],
                password_hash=default_pw_hash,
                role="member",
                created_at=datetime.now(timezone.utc)
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Tạo user mới: {user.username} (#{user.id}) - {user.email}")
        else:
            print(f"User đã tồn tại: {user.username} (#{user.id})")
        created_users.append(user)

    # 3. Thêm vào WorkspaceMember
    added_count = 0
    for user in created_users:
        exists = db.query(models.WorkspaceMember).filter(
            models.WorkspaceMember.workspace_id == ws.id,
            models.WorkspaceMember.user_id == user.id
        ).first()
        if not exists:
            wm = models.WorkspaceMember(
                workspace_id=ws.id,
                user_id=user.id,
                role="MEMBER",
                joined_at=datetime.now(timezone.utc)
            )
            db.add(wm)
            db.commit()
            db.refresh(wm)

            # Log activity
            log_workspace_activity(
                workspace_id=ws.id,
                user_id=owner.id if owner else user.id,
                action_type="MEMBER_ADDED",
                description=f"{owner_name} đã thêm {user.username} (ID: #{user.id}) vào Workspace",
                db=db
            )
            added_count += 1
            print(f"-> Đã thêm {user.username} vào workspace '{ws.name}'")
        else:
            print(f"-> {user.username} đã là thành viên của '{ws.name}'")

    print(f"\n✅ Hoàn tất! Đã thêm thành công {added_count} thành viên vào Workspace '{ws.name}' ({ws.id}).")
    db.close()

if __name__ == "__main__":
    seed()
