import sys
from datetime import datetime, timedelta, timezone
from app.database import SessionLocal
from app import models

def add_tasks():
    sys.stdout.reconfigure(encoding='utf-8')
    db = SessionLocal()
    now_utc = datetime.now(timezone.utc)

    # 1. Lấy thông tin Users
    users_by_email = {u.email: u for u in db.query(models.User).all()}
    u_hoang = users_by_email["viethoang@gmail.com"]
    u_thanh = users_by_email["vanthanh@gmail.com"]
    u_vuanh = users_by_email["vuanh@gmail.com"]
    u_mai = users_by_email["maitran@gmail.com"]
    u_nam = users_by_email["namle@gmail.com"]
    u_duc = users_by_email["ducpham@gmail.com"]

    # 2. Lấy thông tin Workspaces
    ws_list = {w.name: w for w in db.query(models.Workspace).all()}
    ws_main = ws_list["Phát triển Hệ thống Quản lý Dự án"]
    ws_grad = ws_list["Đồ án Tốt nghiệp Python"]
    ws_micro = ws_list["Nghiên cứu Kiến trúc Microservices"]
    ws_ui = ws_list["Thiết kế Giao diện UI/UX & Mobile App"]

    new_tasks_data = [
        # --- Bổ sung cho Workspace 1: Phát triển Hệ thống Quản lý Dự án ---
        {
            "workspace": ws_main,
            "creator": u_hoang,
            "assignee": u_thanh,
            "title": "Tối ưu hóa tốc độ tải trang & Lazy Loading hình ảnh",
            "desc": "Nén tài nguyên tĩnh CSS/JS và trì hoãn tải các icon chưa hiển thị",
            "status": "IN_PROGRESS",
            "priority": "LOW",
            "due_date": now_utc + timedelta(days=5, hours=4),
            "comment": "Em đang thử nghiệm kỹ thuật defer script trên Chrome DevTools."
        },
        {
            "workspace": ws_main,
            "creator": u_hoang,
            "assignee": u_vuanh,
            "title": "Bổ sung tính năng thông báo Email khi được giao việc",
            "desc": "Tích hợp SMTP gửi mail tự động cho thành viên khi có task mới",
            "status": "TODO",
            "priority": "MEDIUM",
            "due_date": now_utc + timedelta(days=6, hours=8),
            "comment": "Sẽ dùng thư viện aiosmtplib để không làm nghẽn luồng xử lý API."
        },
        {
            "workspace": ws_main,
            "creator": u_hoang,
            "assignee": u_mai,
            "title": "Chuẩn hóa tài liệu OpenAPI Swagger UI",
            "desc": "Bổ sung mô tả chi tiết cho từng tham số và mã lỗi phản hồi trên /docs",
            "status": "DONE",
            "priority": "HIGH",
            "due_date": now_utc - timedelta(hours=18),
            "comment": "Đã gắn đầy đủ response_description và summary cho toàn bộ 35 endpoints."
        },

        # --- Bổ sung cho Workspace 2: Đồ án Tốt nghiệp Python ---
        {
            "workspace": ws_grad,
            "creator": u_thanh,
            "assignee": u_thanh,
            "title": "Viết Chương 1: Tổng quan đề tài & Cơ sở lý thuyết",
            "desc": "Trình bày lý do chọn đề tài, đối tượng nghiên cứu và phạm vi ứng dụng",
            "status": "DONE",
            "priority": "HIGH",
            "due_date": now_utc - timedelta(days=3),
            "comment": "Đã hoàn thành 25 trang chương 1, cô Thảo đã duyệt qua bản thảo đầu tiên."
        },
        {
            "workspace": ws_grad,
            "creator": u_thanh,
            "assignee": u_vuanh,
            "title": "Viết Chương 2: Phân tích thiết kế hệ thống & Mô hình ERD",
            "desc": "Mô tả biểu đồ use-case, tuần tự và thiết kế cơ sở dữ liệu quan hệ 3NF",
            "status": "IN_PROGRESS",
            "priority": "URGENT",
            "due_date": now_utc + timedelta(days=2, hours=12),
            "comment": "Đang vẽ lại các diagram tuần tự cho luồng đăng ký và kéo thả Kanban."
        },
        {
            "workspace": ws_grad,
            "creator": u_thanh,
            "assignee": u_hoang,
            "title": "Viết Chương 3: Hiện thực hóa hệ thống & Kết quả thử nghiệm",
            "desc": "Chụp ảnh minh chứng các màn hình tính năng và bảng thống kê kiểm thử API",
            "status": "TODO",
            "priority": "HIGH",
            "due_date": now_utc + timedelta(days=6),
            "comment": "Đang tổng hợp số liệu đo thời gian phản hồi API (dưới 50ms)."
        },
        {
            "workspace": ws_grad,
            "creator": u_thanh,
            "assignee": u_duc,
            "title": "Đóng bìa cứng luận văn & Nộp bản in cho Khoa",
            "desc": "Kiểm tra định dạng font chữ, căn lề theo quy chuẩn của Nhà trường và in bìa mạ vàng",
            "status": "TODO",
            "priority": "LOW",
            "due_date": now_utc + timedelta(days=10),
            "comment": "Đã liên hệ nhà in trước cổng trường để chuẩn bị in 4 quyển."
        },

        # --- Tạo mới cho Workspace 3: Nghiên cứu Kiến trúc Microservices ---
        {
            "workspace": ws_micro,
            "creator": u_vuanh,
            "assignee": u_vuanh,
            "title": "Khởi tạo cụm Docker Swarm & Cấu hình mạng Overlay",
            "desc": "Thiết lập môi trường đa container và cơ chế tự động cân bằng tải",
            "status": "DONE",
            "priority": "HIGH",
            "due_date": now_utc - timedelta(days=2, hours=6),
            "comment": "Đã chạy thử cụm 3 node worker ổn định."
        },
        {
            "workspace": ws_micro,
            "creator": u_vuanh,
            "assignee": u_hoang,
            "title": "Tách Authentication Service thành dịch vụ độc lập",
            "desc": "Tách riêng module cấp phát và thẩm định JWT Token qua gRPC",
            "status": "IN_PROGRESS",
            "priority": "URGENT",
            "due_date": now_utc + timedelta(days=2, hours=4),
            "comment": "Tốc độ xác thực qua gRPC nhanh hơn REST thông thường 3.5 lần."
        },
        {
            "workspace": ws_micro,
            "creator": u_vuanh,
            "assignee": u_thanh,
            "title": "Tích hợp RabbitMQ để truyền thông điệp bất đồng bộ",
            "desc": "Sử dụng Message Queue để xử lý tác vụ gửi thông báo và tính toán nặng",
            "status": "REVIEW",
            "priority": "HIGH",
            "due_date": now_utc + timedelta(days=3, hours=10),
            "comment": "Đã viết xong Producer và Consumer cho hàng đợi activity_logs."
        },
        {
            "workspace": ws_micro,
            "creator": u_vuanh,
            "assignee": u_mai,
            "title": "Thiết lập API Gateway định tuyến và Rate Limiting",
            "desc": "Sử dụng Traefik hoặc Nginx làm cửa ngõ định tuyến duy nhất cho client",
            "status": "TODO",
            "priority": "MEDIUM",
            "due_date": now_utc + timedelta(days=5, hours=14),
            "comment": None
        },
        {
            "workspace": ws_micro,
            "creator": u_vuanh,
            "assignee": u_duc,
            "title": "Cấu hình giám sát hiệu năng với Prometheus & Grafana",
            "desc": "Thu thập chỉ số CPU, RAM, thời gian phản hồi và vẽ dashboard trực quan",
            "status": "TODO",
            "priority": "LOW",
            "due_date": now_utc + timedelta(days=8),
            "comment": None
        },

        # --- Tạo mới cho Workspace 4: Thiết kế Giao diện UI/UX & Mobile App ---
        {
            "workspace": ws_ui,
            "creator": u_hoang,
            "assignee": u_nam,
            "title": "Nghiên cứu Design System & Bảng màu Linear Theme",
            "desc": "Lựa chọn font chữ Inter, bảng màu Dark/Light Mode và các quy tắc bo góc",
            "status": "DONE",
            "priority": "HIGH",
            "due_date": now_utc - timedelta(days=1),
            "comment": "Đã xuất ra bộ style guide trên Figma cho cả nhóm tham khảo."
        },
        {
            "workspace": ws_ui,
            "creator": u_hoang,
            "assignee": u_vuanh,
            "title": "Thiết kế Wireframe trên Figma cho phiên bản Mobile",
            "desc": "Dựng khung giao diện Responsive cho màn hình điện thoại từ 375px đến 768px",
            "status": "IN_PROGRESS",
            "priority": "HIGH",
            "due_date": now_utc + timedelta(days=1, hours=10),
            "comment": "Đã dựng xong luồng Kanban vuốt ngang mượt mà trên mobile."
        },
        {
            "workspace": ws_ui,
            "creator": u_hoang,
            "assignee": u_mai,
            "title": "Tối ưu hóa khả năng tiếp cận (Accessibility WCAG 2.1)",
            "desc": "Kiểm tra độ tương phản màu chữ, gắn aria-label cho các nút icon và hỗ trợ phím Tab",
            "status": "REVIEW",
            "priority": "MEDIUM",
            "due_date": now_utc + timedelta(days=3, hours=6),
            "comment": "Điểm Lighthouse Accessibility hiện đã đạt 98/100."
        },
        {
            "workspace": ws_ui,
            "creator": u_hoang,
            "assignee": u_hoang,
            "title": "Xây dựng tính năng chuyển đổi giao diện Dark Mode",
            "desc": "Lưu trạng thái giao diện vào localStorage và chuyển đổi mượt mà qua CSS Variables",
            "status": "TODO",
            "priority": "MEDIUM",
            "due_date": now_utc + timedelta(days=4, hours=16),
            "comment": None
        },
        {
            "workspace": ws_ui,
            "creator": u_hoang,
            "assignee": u_nam,
            "title": "Khảo sát trải nghiệm người dùng (Usability Testing)",
            "desc": "Mời 15 sinh viên dùng thử hệ thống và điền bảng đánh giá mức độ hài lòng SUS",
            "status": "TODO",
            "priority": "LOW",
            "due_date": now_utc + timedelta(days=7),
            "comment": None
        }
    ]

    print(f"Bắt đầu chèn {len(new_tasks_data)} công việc mới vào các dự án...")

    for td in new_tasks_data:
        task = models.Task(
            title=td["title"],
            description=td["desc"],
            status=td["status"],
            priority=td["priority"],
            due_date=td["due_date"],
            workspace_id=td["workspace"].id,
            creator_id=td["creator"].id,
            assignee_id=td["assignee"].id,
            created_at=now_utc - timedelta(days=2)
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        # Log TaskActivity
        act_task = models.TaskActivity(
            task_id=task.id,
            user_id=td["creator"].id,
            action_type="TASK_CREATED",
            description=f"{td['creator'].username} đã tạo công việc '{task.title}' và giao cho {td['assignee'].username}",
            created_at=now_utc - timedelta(days=2)
        )
        db.add(act_task)

        # Log WorkspaceActivity
        act_ws = models.WorkspaceActivity(
            workspace_id=td["workspace"].id,
            user_id=td["creator"].id,
            action_type="TASK_CREATED",
            description=f"{td['creator'].username} đã thêm công việc: '{task.title}'",
            created_at=now_utc - timedelta(days=2)
        )
        db.add(act_ws)

        # Thêm bình luận nếu có
        if td.get("comment"):
            cmt = models.TaskComment(
                task_id=task.id,
                user_id=td["assignee"].id,
                content=td["comment"],
                created_at=now_utc - timedelta(hours=6)
            )
            db.add(cmt)

        db.commit()
        print(f" -> Đã thêm: [{td['workspace'].name}] #{task.id}: {task.title} ({task.status}) - Giao cho: {td['assignee'].username}")

    db.close()
    print("\n✅ HOÀN TẤT! Đã bổ sung thành công tất cả công việc vào 4 dự án.")

if __name__ == '__main__':
    add_tasks()
