import sys
from datetime import datetime, timezone
from sqlalchemy import text
from app.database import engine, SessionLocal, Base
from app import models, security

def reset_and_seed():
    print("=" * 60)
    print("   KHỞI TẠO VÀ DỌN DẸP CƠ SỞ DỮ LIỆU PMSPRO")
    print("=" * 60)

    try:
        # Bước 1: Xóa các bảng cũ (tránh xung đột Foreign Key VARCHAR vs INT)
        print("\n[1/3] Đang xóa các bảng cũ có thể bị lệch schema...")
        with engine.connect() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            tables = [
                "task_comments", "task_activities", "meetings",
                "tasks", "task_statuses", "workspace_members",
                "workspaces", "users"
            ]
            for t in tables:
                conn.execute(text(f"DROP TABLE IF EXISTS {t};"))
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            conn.commit()
        print("  -> Đã dọn dẹp các bảng cũ thành công.")

        # Bước 2: Tạo lại tất cả bảng với schema mới
        print("\n[2/3] Đang tạo mới toàn bộ các bảng theo schema mới...")
        Base.metadata.create_all(bind=engine)
        print("  -> Đã tạo các bảng users, workspaces, task_statuses, tasks thành công!")

        # Bước 3: Nạp dữ liệu mẫu giống hệt trong Ảnh 1
        print("\n[3/3] Đang nạp dữ liệu mẫu (owner_4466, Dự án Phần Mềm #4466)...")
        db = SessionLocal()
        try:
            # Tạo tài khoản Owner
            owner = models.User(
                id="t5xgffvkqYZa",
                username="owner_4466",
                email="owner_4466@demo.com",
                password_hash=security.get_password_hash("123456"),
                role="member"
            )
            db.add(owner)
            db.commit()
            db.refresh(owner)

            # Tạo Workspace
            ws = models.Workspace(
                id="ws4466app",
                name="Dự án Phần Mềm #4466",
                description="Không gian làm việc phát triển ứng dụng",
                owner_id=owner.id
            )
            db.add(ws)
            db.commit()
            db.refresh(ws)

            # Tạo 3 trạng thái chuẩn của Workspace
            st_todo = models.TaskStatus(name="TODO", color="#718096", order=1, workspace_id=ws.id)
            st_in_progress = models.TaskStatus(name="IN_PROGRESS", color="#3182ce", order=2, workspace_id=ws.id)
            st_done = models.TaskStatus(name="DONE", color="#38a169", order=3, workspace_id=ws.id)
            db.add_all([st_todo, st_in_progress, st_done])
            db.commit()
            db.refresh(st_todo)
            db.refresh(st_in_progress)
            db.refresh(st_done)

            # Tạo 3 task giống hệt Ảnh 1 (với id #2, #3, #4)
            task2 = models.Task(
                id=2,
                title="Xây dựng sơ đồ cơ sở dữ liệu",
                description="Thiết kế các bảng và quan hệ khóa ngoại",
                status="DONE",
                status_id=st_done.id,
                priority="HIGH",
                due_date=datetime(2026, 10, 23, 23, 59, 59, tzinfo=timezone.utc),
                workspace_id=ws.id,
                creator_id=owner.id,
                assignee_id=None
            )

            task3 = models.Task(
                id=3,
                title="Tùy chỉnh trạng thái Workspace",
                description="Bổ sung API cập nhật status cho Owner",
                status="IN_PROGRESS",
                status_id=st_in_progress.id,
                priority="URGENT",
                due_date=None,
                workspace_id=ws.id,
                creator_id=owner.id,
                assignee_id=None
            )

            task4 = models.Task(
                id=4,
                title="Viết báo cáo kết quả đồ án",
                description="Hoàn thiện tài liệu nghiệm thu hệ thống",
                status="TODO",
                status_id=st_todo.id,
                priority="MEDIUM",
                due_date=None,
                workspace_id=ws.id,
                creator_id=owner.id,
                assignee_id=None
            )

            db.add_all([task2, task3, task4])
            db.commit()

            print("\n" + "=" * 60)
            print("   HOÀN TẤT KHỞI TẠO THÀNH CÔNG!")
            print("   - Tài khoản đăng nhập:")
            print("       Email:    owner_4466@demo.com")
            print("       Mật khẩu: 123456")
            print("   - Workspace:  Dự án Phần Mềm #4466")
            print("   - 3 công việc mẫu: #2 (DONE), #3 (IN_PROGRESS), #4 (TODO)")
            print("=" * 60)
        finally:
            db.close()

    except Exception as e:
        print(f"\n[LỖI]: Không thể kết nối hoặc khởi tạo cơ sở dữ liệu: {e}")
        print("Vui lòng kiểm tra lại Docker MySQL đang chạy (port 3307) và file .env")
        sys.exit(1)

if __name__ == "__main__":
    reset_and_seed()
