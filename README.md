TRANG WEB HỆ THỐNG QUẢN LÝ DỰ ÁN\
Đây là trang web được làm ra cho những người muốn sắp xếp và quản lý công việc của bản thân một cách khoa học và có hiệu quả.\
Yêu cầu cần có kiến thức cơ bản về Python, Docker, MySQL(SQLite), các thư viện trong Python.\
1.Để có thể sử dụng trang web, đầu tiên các bạn cần tải về phần mềm Python phiên bản mới nhất ở máy, các bạn có thể tải ở đây: "https://www.python.org/downloads/".\
2.Sau khi tải xong, cài đặt đầy đủ các thứ cho Python thì chúng ta cần môi trường ảo (.venv) để các file trong Python có thể chạy, để kích hoạt môi trường ảo ta có thể viết ngay trên terminal như sau: "python -m venv .venv" với Windos, "python3 -m venv .venv" với MacOS/Linux.\
3.Khi đã có .venv, ta tiến hành cài đặt các thư viện cần thiết cho dự án (các thư viện được nằm trong file 'requirements.txt'), ta sử dụng lệnh sau ở console bash thay vì console Local: "pip install -r requirements_update.txt --upgrade".\
4.Ngoài ra chúng ta cần phải khởi chạy các phần mềm cơ sở dữ liệu (như MySQL, SQLite hoặc chạy thông qua Docker), thông tin của cơ sở dữ liệu nằm ở file .env, thông tin cài đặt kết nối Docker thì nằm ở file docker-compose.yaml.\
5.Cuối cùng, chúng ta sử dụng lệnh "uvicorn app.main:app --reload" dể khởi chạy dự án (ở đây chúng ta đang sử dụng thư viện uvicorn).\
6.Khi xuất hiện một số dòng lệnh thông báo của hệ thống thì ta nhấn vào đường dẫn có tên  http://127.0.0.1:8000 để vào trang web.\
7.Sau khi vào được trang web chúng ta cần phải tạo một tài khoản mới. Sau khi đăng nhập thành công bằng tài khoản đó chúng ta có thể sử dụng các tính năng như thêm dự án, tham gia dự án thông qua ID của dự án đó, lên lịch hẹn,... .\
CHÚC CÁC BẠN THÀNH CÔNG VÀ CẢM ƠN CÁC BẠN ĐÃ SỬ DỤNG TRANG WEB CỦA CHÚNG MÌNH.
