import sys
from datetime import datetime, timedelta, timezone
from app.database import engine, Base, SessionLocal
from app import models
from app.security import get_password_hash

def run_seed():
    sys.stdout.reconfigure(encoding='utf-8')
    print("1. Đang làm sạch toàn bộ dữ liệu cũ...")

    # Drop all tables and recreate them
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("-> Đã tạo lại cấu trúc database trắng tinh!")

    db = SessionLocal()
    default_pw_hash = get_password_hash("123456")
    now_utc = datetime.now(timezone.utc)

    print("\n2. Đang tạo 6 User tài khoản...")
    users_data = [
        {"name": "Lưu Việt Hoàng", "email": "viethoang@gmail.com", "role": "admin"},
        {"name": "Nguyễn Văn Thành", "email": "vanthanh@gmail.com", "role": "member"},
        {"name": "Nguyễn Vũ Anh", "email": "vuanh@gmail.com", "role": "member"},
        {"name": "Trần Thị Mai", "email": "maitran@gmail.com", "role": "member"},
        {"name": "Lê Hoàng Nam", "email": "namle@gmail.com", "role": "member"},
        {"name": "Phạm Minh Đức", "email": "ducpham@gmail.com", "role": "member"},
    ]

    users = {}
    for u in users_data:
        user = models.User(
            username=u["name"],
            email=u["email"],
            password_hash=default_pw_hash,
            role=u["role"],
            created_at=now_utc - timedelta(days=10)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        users[u["email"]] = user
        print(f"   [User] {user.username} (#{user.id}) - {user.email}")

    u_hoang = users["viethoang@gmail.com"]
    u_thanh = users["vanthanh@gmail.com"]
    u_vuanh = users["vuanh@gmail.com"]
    u_mai = users["maitran@gmail.com"]
    u_nam = users["namle@gmail.com"]
    u_duc = users["ducpham@gmail.com"]

    print("\n3. Đang tạo 4 Workspace...")
    workspaces_data = [
        {
            "name": "Phát triển Hệ thống Quản lý Dự án",
            "desc": "Dự án xây dựng nền tảng PMS bằng Python FastAPI, SQLAlchemy và FullCalendar",
            "owner": u_hoang,
            "members": [u_thanh, u_vuanh, u_mai, u_nam]
        },
        {
            "name": "Đồ án Tốt nghiệp Python",
            "desc": "Nghiên cứu và triển khai ứng dụng quản lý tiến độ theo thời gian thực",
            "owner": u_thanh,
            "members": [u_hoang, u_vuanh, u_duc]
        },
        {
            "name": "Nghiên cứu Kiến trúc Microservices",
            "desc": "Thiết kế hệ thống phân tán, xử lý tải cao và tối ưu hóa cơ sở dữ liệu",
            "owner": u_vuanh,
            "members": [u_hoang, u_thanh, u_mai, u_duc]
        },
        {
            "name": "Thiết kế Giao diện UI/UX & Mobile App",
            "desc": "Tối ưu hóa trải nghiệm người dùng, tương tác Kanban và Lịch biểu đa nền tảng",
            "owner": u_hoang,
            "members": [u_vuanh, u_nam, u_mai]
        }
    ]

    workspaces = []
    for wd in workspaces_data:
        ws = models.Workspace(
            name=wd["name"],
            description=wd["desc"],
            owner_id=wd["owner"].id,
            created_at=now_utc - timedelta(days=7)
        )
        db.add(ws)
        db.commit()
        db.refresh(ws)
        workspaces.append(ws)
        print(f"   [Workspace] {ws.name} (#{ws.id}) - Owner: {wd['owner'].username}")

        # Thêm các thành viên vào WorkspaceMember
        for m in wd["members"]:
            member_entry = models.WorkspaceMember(
                workspace_id=ws.id,
                user_id=m.id,
                role="MEMBER",
                joined_at=now_utc - timedelta(days=6)
            )
            db.add(member_entry)

        # Ghi nhật ký khởi tạo Workspace
        act1 = models.WorkspaceActivity(
            workspace_id=ws.id,
            user_id=wd["owner"].id,
            action_type="WORKSPACE_CREATED",
            description=f"{wd['owner'].username} đã khởi tạo dự án '{ws.name}'",
            created_at=now_utc - timedelta(days=7)
        )
        db.add(act1)
        for m in wd["members"]:
            act_m = models.WorkspaceActivity(
                workspace_id=ws.id,
                user_id=wd["owner"].id,
                action_type="MEMBER_ADDED",
                description=f"{wd['owner'].username} đã thêm {m.username} vào dự án",
                created_at=now_utc - timedelta(days=6)
            )
            db.add(act_m)

        db.commit()

    ws_main = workspaces[0]  # "Phát triển Hệ thống Quản lý Dự án"
    ws_grad = workspaces[1]  # "Đồ án Tốt nghiệp Python"

    print("\n4. Đang tạo các Task & Phân công công việc (Kanban)...")
    tasks_data = [
        {
            "title": "Thiết kế kiến trúc cơ sở dữ liệu ERD",
            "desc": "Mô hình hóa các thực thể Users, Workspaces, Tasks, Meetings và Activities chuẩn 3NF",
            "status": "DONE",
            "priority": "HIGH",
            "due_date": now_utc - timedelta(days=1, hours=4),
            "assignee": u_thanh,
            "creator": u_hoang,
            "workspace": ws_main
        },
        {
            "title": "Phát triển các API Authentication & Cấp phát JWT",
            "desc": "Xây dựng endpoint đăng ký, đăng nhập, băm mật khẩu Bcrypt và tạo token HS256",
            "status": "DONE",
            "priority": "URGENT",
            "due_date": now_utc + timedelta(hours=14),
            "assignee": u_vuanh,
            "creator": u_hoang,
            "workspace": ws_main
        },
        {
            "title": "Xây dựng bảng Kanban kéo thả 4 cột trạng thái",
            "desc": "Triển khai bảng điều khiển công việc TODO, IN_PROGRESS, REVIEW, DONE với phân quyền RBAC",
            "status": "IN_PROGRESS",
            "priority": "HIGH",
            "due_date": now_utc + timedelta(days=2, hours=6),
            "assignee": u_hoang,
            "creator": u_hoang,
            "workspace": ws_main
        },
        {
            "title": "Tích hợp FullCalendar 6 & Thanh Live Time Bar",
            "desc": "Đồng bộ hóa múi giờ ISO 8601 UTC và hiển thị thanh mốc giờ thời gian thực",
            "status": "IN_PROGRESS",
            "priority": "MEDIUM",
            "due_date": now_utc + timedelta(days=3, hours=8),
            "assignee": u_hoang,
            "creator": u_hoang,
            "workspace": ws_main
        },
        {
            "title": "Kiểm thử API bảo mật và viết tài liệu báo cáo BTL",
            "desc": "Rà soát mã lỗi 403 Forbidden, kiểm thử tải và hoàn thiện slide thuyết trình",
            "status": "REVIEW",
            "priority": "URGENT",
            "due_date": now_utc + timedelta(days=4, hours=10),
            "assignee": u_mai,
            "creator": u_hoang,
            "workspace": ws_main
        },
        {
            "title": "Đóng gói ứng dụng vào Docker & Cấu hình Docker Compose",
            "desc": "Tạo Dockerfile cho Backend FastAPI và liên kết dịch vụ MySQL qua compose",
            "status": "TODO",
            "priority": "MEDIUM",
            "due_date": now_utc + timedelta(days=7),
            "assignee": u_nam,
            "creator": u_hoang,
            "workspace": ws_main
        },
        {
            "title": "Khảo sát yêu cầu bài toán quản lý và lập kế hoạch",
            "desc": "Phỏng vấn người dùng mục tiêu và vẽ sơ đồ phân rã chức năng hệ thống",
            "status": "DONE",
            "priority": "MEDIUM",
            "due_date": now_utc - timedelta(days=2),
            "assignee": u_thanh,
            "creator": u_thanh,
            "workspace": ws_grad
        },
        {
            "title": "Hoàn thiện nội dung slide thuyết trình Canva 5 phút",
            "desc": "Chuẩn hóa 9 slide báo cáo gồm kiến trúc Client-Server, ERD và phân hệ tính năng",
            "status": "IN_PROGRESS",
            "priority": "HIGH",
            "due_date": now_utc + timedelta(days=1, hours=18),
            "assignee": u_vuanh,
            "creator": u_thanh,
            "workspace": ws_grad
        },
        {
            "title": "Tổng duyệt kịch bản và chuẩn bị demo thực tế",
            "desc": "Chạy thử hệ thống trên máy chiếu và diễn tập trả lời các câu hỏi vấn đáp",
            "status": "TODO",
            "priority": "URGENT",
            "due_date": now_utc + timedelta(days=5),
            "assignee": u_hoang,
            "creator": u_thanh,
            "workspace": ws_grad
        }
    ]

    created_tasks = []
    for td in tasks_data:
        task = models.Task(
            title=td["title"],
            description=td["desc"],
            status=td["status"],
            priority=td["priority"],
            due_date=td["due_date"],
            workspace_id=td["workspace"].id,
            creator_id=td["creator"].id,
            assignee_id=td["assignee"].id,
            created_at=now_utc - timedelta(days=3)
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        created_tasks.append(task)

        # Log task activity
        act_task = models.TaskActivity(
            task_id=task.id,
            user_id=td["creator"].id,
            action_type="TASK_CREATED",
            description=f"{td['creator'].username} đã tạo công việc '{task.title}' và giao cho {td['assignee'].username}",
            created_at=now_utc - timedelta(days=3)
        )
        db.add(act_task)

        # Log workspace activity
        act_ws = models.WorkspaceActivity(
            workspace_id=td["workspace"].id,
            user_id=td["creator"].id,
            action_type="TASK_CREATED",
            description=f"{td['creator'].username} đã tạo công việc mới: '{task.title}'",
            created_at=now_utc - timedelta(days=3)
        )
        db.add(act_ws)

        db.commit()
        print(f"   [Task #{task.id}] {task.title} ({task.status} - {task.priority}) -> {td['assignee'].username}")

    print("\n5. Đang thêm các bình luận trao đổi mẫu trong Task...")
    comments_data = [
        {"task": created_tasks[0], "user": u_thanh, "content": "Em đã thiết kế xong bảng ERD và tối ưu các chỉ mục index, mời anh Hoàng review giúp em!"},
        {"task": created_tasks[0], "user": u_hoang, "content": "Thiết kế chuẩn 3NF rồi nhé Thành, các ràng buộc CASCADE và SET NULL rất hợp lý."},
        {"task": created_tasks[1], "user": u_vuanh, "content": "Các API Auth đã test xong trên Postman, token JWT bảo mật tốt."},
        {"task": created_tasks[2], "user": u_hoang, "content": "Đang hoàn thiện cơ chế kéo thả Kanban, đã chặn 403 Forbidden chuẩn cho Member."},
        {"task": created_tasks[7], "user": u_vuanh, "content": "Slide Canva đã chuẩn hóa 9 slide khớp từng chữ với kịch bản thuyết trình 5 phút."},
    ]
    for c in comments_data:
        cmt = models.TaskComment(
            task_id=c["task"].id,
            user_id=c["user"].id,
            content=c["content"],
            created_at=now_utc - timedelta(hours=12)
        )
        db.add(cmt)
    db.commit()

    print("\n6. Đang lên lịch các cuộc họp và hoạt động trên Calendar...")
    # Lên lịch họp xung quanh tuần hiện tại để hiển thị đẹp trên Lịch
    base_date = now_utc.replace(minute=0, second=0, microsecond=0)
    meetings_data = [
        {
            "title": "Họp Kickoff & Phân chia công việc tuần mới",
            "desc": "Thống nhất mục tiêu tuần, phân công đầu việc và chốt lịch nộp báo cáo",
            "link": "https://meet.jit.si/pms-kickoff-planning-2026",
            "start": base_date + timedelta(days=1, hours=2),  # Ngày mai 09:00 hoặc chiều
            "end": base_date + timedelta(days=1, hours=3, minutes=30),
            "workspace": ws_main,
            "creator": u_hoang,
            "task_id": created_tasks[2].id
        },
        {
            "title": "Review thiết kế Cơ sở dữ liệu & API Backend",
            "desc": "Rà soát các mô hình thực thể ERD, quan hệ khóa ngoại và bảo mật JWT",
            "link": "https://meet.jit.si/pms-backend-review-db",
            "start": base_date + timedelta(days=2, hours=4),
            "end": base_date + timedelta(days=2, hours=5, minutes=30),
            "workspace": ws_main,
            "creator": u_vuanh,
            "task_id": created_tasks[0].id
        },
        {
            "title": "Kiểm thử tích hợp FullCalendar & Live Time Bar",
            "desc": "Demo thử nghiệm thanh Live Time Bar phát sáng và chuẩn hóa múi giờ UTC",
            "link": "https://meet.jit.si/pms-calendar-qa-test",
            "start": base_date + timedelta(days=3, hours=1),
            "end": base_date + timedelta(days=3, hours=2, minutes=30),
            "workspace": ws_main,
            "creator": u_hoang,
            "task_id": created_tasks[3].id
        },
        {
            "title": "Họp tổng duyệt kịch bản báo cáo Bài tập lớn",
            "desc": "Chạy thử kịch bản thuyết trình 5 phút và chuẩn bị các câu hỏi phản biện",
            "link": "https://meet.jit.si/pms-tong-duyet-btl",
            "start": base_date + timedelta(days=4, hours=6),
            "end": base_date + timedelta(days=4, hours=8),
            "workspace": ws_grad,
            "creator": u_thanh,
            "task_id": created_tasks[7].id
        },
        {
            "title": "Báo cáo chính thức sản phẩm trước Hội đồng",
            "desc": "Thuyết trình và demo toàn diện hệ thống Project Management System",
            "link": "https://meet.jit.si/pms-final-presentation",
            "start": base_date + timedelta(days=6, hours=2),
            "end": base_date + timedelta(days=6, hours=4),
            "workspace": ws_main,
            "creator": u_hoang,
            "task_id": None
        }
    ]

    for md in meetings_data:
        meeting = models.Meeting(
            title=md["title"],
            description=md["desc"],
            meeting_link=md["link"],
            start_time=md["start"],
            end_time=md["end"],
            workspace_id=md["workspace"].id,
            creator_id=md["creator"].id,
            task_id=md["task_id"],
            created_at=now_utc - timedelta(days=2)
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        # Log workspace activity
        act_meet = models.WorkspaceActivity(
            workspace_id=md["workspace"].id,
            user_id=md["creator"].id,
            action_type="MEETING_CREATED",
            description=f"{md['creator'].username} đã lên lịch cuộc họp: '{meeting.title}'",
            created_at=now_utc - timedelta(days=2)
        )
        db.add(act_meet)
        db.commit()
        print(f"   [Meeting #{meeting.id}] {meeting.title} ({meeting.start_time.strftime('%d/%m %H:%M')})")

    db.close()
    print("\n✅ TOÀN BỘ QUÁ TRÌNH KHỞI TẠO VÀ CHÈN DỮ LIỆU ĐÃ THÀNH CÔNG RỰC RỠ!")

if __name__ == "__main__":
    run_seed()
