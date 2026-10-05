/**
 * Project Management System - Frontend Controller
 * Viết bằng Javascript thuần (Vanilla JS) kết nối REST API FastAPI
 */

// Tự động phát hiện Backend URL
const API_BASE = (window.location.port === "8000") ? "" : "http://127.0.0.1:8000";
// 4 biến trạng thái
let currentWorkspaceId = null; // Lưu ID của Workspace mà người dùng đang chọn xem
let currentTaskId = null; // Lưu ID của Task đang được mở trong cửa sổ popup (Modal)
let currentMeetingId = null; // Lưu ID của cuộc họp đang được xem
let calendarInstance = null; // Đối tượng lưu trữ phiên bản lịch của thư viện FullCalendar

// ==========================================
// 1. HELPER GỌI API & QUẢN LÝ TOKEN JWT
// ==========================================
// localStorage: Bộ nhớ cục bộ của trình duyệt. Khi đăng nhập thành công, chuỗi Token JWT sẽ được cất vào đây.
function getToken() {
    return localStorage.getItem("pms_token");
}

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem("pms_user") || "null");
    } catch {
        return null;
    }
}

function setAuth(token, user) {
    localStorage.setItem("pms_token", token);
    localStorage.setItem("pms_user", JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem("pms_token");
    localStorage.removeItem("pms_user");
}

async function apiCall(endpoint, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`; // Tự động gắn Token vào mỗi request
    }

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body); // Ép dữ liệu js sang chuỗi JSON
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        if (response.status === 401) {
            alert("Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại!");
            handleLogout();
            return null;
        }
        if (response.status === 204) {
            return true; // Xóa thành công No Content
        }
        const data = await response.json();
        if (!response.ok) {
            alert(data.detail || "Đã xảy ra lỗi, vui lòng thử lại!");
            return null;
        }
        return data;
    } catch (err) {
        console.error("Fetch Error:", err);
        alert("Không thể kết nối đến máy chủ Backend! Hãy chắc chắn FastAPI server đang chạy ở port 8000.");
        return null;
    }
}


// ==========================================
// 2. KHỞI CHẠY ỨNG DỤNG & XÁC THỰC (AUTH)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    checkAuthState();
});

function checkAuthState() {
    const token = getToken();
    const user = getCurrentUser();
    const authScreen = document.getElementById("auth-screen");

    if (token && user) {
        authScreen.classList.add("hidden");
        // Hiển thị thông tin profile ở sidebar
        document.getElementById("user-display-name").textContent = user.username || "User";
        document.getElementById("user-display-email").textContent = user.email || "";
        document.getElementById("user-avatar-initial").textContent = (user.username || "U").charAt(0).toUpperCase();

        // Tải danh sách Workspace
        loadWorkspaces();
    } else {
        authScreen.classList.remove("hidden");
    }
}

function showAuthTab(tab) {
    const loginForm = document.getElementById("login-form");
    const regForm = document.getElementById("register-form");
    const tabLogin = document.getElementById("tab-login-btn");
    const tabReg = document.getElementById("tab-register-btn");

    if (tab === "login") {
        loginForm.classList.remove("hidden");
        regForm.classList.add("hidden");
        tabLogin.className = "flex-1 pb-3 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600";
        tabReg.className = "flex-1 pb-3 text-sm font-semibold text-slate-400 border-b-2 border-transparent hover:text-slate-600";
    } else {
        loginForm.classList.add("hidden");
        regForm.classList.remove("hidden");
        tabReg.className = "flex-1 pb-3 text-sm font-semibold text-emerald-600 border-b-2 border-emerald-600";
        tabLogin.className = "flex-1 pb-3 text-sm font-semibold text-slate-400 border-b-2 border-transparent hover:text-slate-600";
    }
}

async function handleLogin(e) {
    // Ngăn trình duyệt tự động load lại trang khi bấm submit form
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    const data = await apiCall("/auth/login", "POST", { email, password });
    if (data && data.access_token) {
        // Tạm lưu thông tin user từ email
        const userObj = {
            username: email.split("@")[0],
            email: email
        };
        setAuth(data.access_token, userObj);
        checkAuthState();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;

    const res = await apiCall("/auth/register", "POST", { username, email, password });
    if (res) {
        alert("Đăng ký thành công! Hãy đăng nhập bằng tài khoản mới.");
        showAuthTab("login");
        document.getElementById("login-email").value = email;
    }
}

function handleLogout() {
    clearAuth();
    location.reload();
}


// ==========================================
// 3. QUẢN LÝ WORKSPACE
// ==========================================

async function loadWorkspaces() {
    const workspaces = await apiCall("/workspaces", "GET");
    const select = document.getElementById("workspace-select");
    select.innerHTML = "";

    if (!workspaces || workspaces.length === 0) {
        select.innerHTML = `<option value="">Chưa có Workspace nào (Hãy tạo mới)</option>`;
        document.getElementById("current-workspace-title").textContent = "Chưa có Workspace";
        document.getElementById("current-workspace-desc").textContent = "Bấm nút '+ Tạo mới' để bắt đầu";
        return;
    }

    workspaces.forEach(ws => {
        const opt = document.createElement("option");
        opt.value = ws.id;
        opt.textContent = ws.name;
        select.appendChild(opt);
    });

    // Chọn workspace đầu tiên
    currentWorkspaceId = workspaces[0].id;
    updateWorkspaceHeader(workspaces[0]);
    reloadCurrentView();
}

function onWorkspaceChange() {
    const select = document.getElementById("workspace-select");
    currentWorkspaceId = select.value;
    const selectedText = select.options[select.selectedIndex].text;
    document.getElementById("current-workspace-title").textContent = selectedText;
    reloadCurrentView();
}

function updateWorkspaceHeader(ws) {
    document.getElementById("current-workspace-title").textContent = ws.name;
    document.getElementById("current-workspace-desc").textContent = ws.description || "Workspace quản lý dự án";
}

async function handleCreateWorkspace(e) {
    e.preventDefault();
    const name = document.getElementById("ws-name").value.trim();
    const description = document.getElementById("ws-desc").value.trim();

    const newWs = await apiCall("/workspaces", "POST", { name, description });
    if (newWs) {
        closeModal("create-workspace-modal");
        document.getElementById("ws-name").value = "";
        document.getElementById("ws-desc").value = "";
        await loadWorkspaces();
        // Chuyển sang workspace mới tạo
        document.getElementById("workspace-select").value = newWs.id;
        currentWorkspaceId = newWs.id;
        updateWorkspaceHeader(newWs);
        reloadCurrentView();
    }
}


// ==========================================
// 4. CHUYỂN TAB & ĐIỀU HƯỚNG GIAO DIỆN
// ==========================================

let activeTab = "kanban";

function switchTab(tab) {
    activeTab = tab;
    const tabs = ["kanban", "calendar", "summary", "members"];
    
    tabs.forEach(t => {
        const sec = document.getElementById(`tab-${t}`);
        const btn = document.getElementById(`nav-${t}`);
        if (t === tab) {
            sec.classList.remove("hidden");
            btn.className = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50/80 transition";
            btn.querySelector("i").className = btn.querySelector("i").className.replace("text-slate-400", "text-indigo-600");
        } else {
            sec.classList.add("hidden");
            btn.className = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition";
            btn.querySelector("i").className = btn.querySelector("i").className.replace("text-indigo-600", "text-slate-400");
        }
    });

    reloadCurrentView();
}

function reloadCurrentView() {
    if (!currentWorkspaceId) return;

    if (activeTab === "kanban") {
        loadKanbanBoard();
    } else if (activeTab === "calendar") {
        initOrRefreshCalendar();
    } else if (activeTab === "summary") {
        loadSummary();
    } else if (activeTab === "members") {
        loadMembers();
    }
}


// ==========================================
// 5. BẢNG KANBAN BOARD (TASK UI - NGƯỜI 3)
// ==========================================

async function loadKanbanBoard() {
    if (!currentWorkspaceId) return;

    const data = await apiCall(`/workspaces/${currentWorkspaceId}/kanban`, "GET");
    if (!data) return;

    // Cập nhật số lượng badge
    document.getElementById("badge-todo-count").textContent = data.todo.length;
    document.getElementById("badge-inprogress-count").textContent = data.in_progress.length;
    document.getElementById("badge-done-count").textContent = data.done.length;
    document.getElementById("badge-cancelled-count").textContent = data.cancelled.length;

    // Render từng cột
    renderKanbanColumn("col-todo", data.todo, "TODO");
    renderKanbanColumn("col-in-progress", data.in_progress, "IN_PROGRESS");
    renderKanbanColumn("col-done", data.done, "DONE");
    renderKanbanColumn("col-cancelled", data.cancelled, "CANCELLED");
}

function renderKanbanColumn(containerId, tasks, status) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="h-28 border-2 border-dashed border-slate-300/60 rounded-xl flex items-center justify-center text-xs font-semibold text-slate-400">
                Chưa có task nào
            </div>
        `;
        return;
    }

    tasks.forEach(task => {
        const card = document.createElement("div");
        card.className = "kanban-card bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 hover:border-indigo-200";

        // Màu thẻ độ ưu tiên
        const priorityColors = {
            "LOW": "bg-slate-100 text-slate-600",
            "MEDIUM": "bg-blue-50 text-blue-600",
            "HIGH": "bg-amber-50 text-amber-600",
            "URGENT": "bg-rose-50 text-rose-600"
        };
        const pClass = priorityColors[task.priority] || priorityColors["MEDIUM"];

        // Format ngày hạn chót
        const dueText = task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : null;

        card.innerHTML = `
            <div class="flex items-start justify-between gap-2 mb-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${pClass}">${task.priority}</span>
                <select onchange="handleQuickStatusChange(${task.id}, this.value)" class="text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-lg px-2 py-0.5 border border-slate-200 focus:outline-none">
                    <option value="TODO" ${task.status === "TODO" ? "selected" : ""}>TODO</option>
                    <option value="IN_PROGRESS" ${task.status === "IN_PROGRESS" ? "selected" : ""}>IN_PROGRESS</option>
                    <option value="DONE" ${task.status === "DONE" ? "selected" : ""}>DONE</option>
                    <option value="CANCELLED" ${task.status === "CANCELLED" ? "selected" : ""}>CANCELLED</option>
                </select>
            </div>
            <h4 onclick="openTaskDetail(${task.id})" class="font-bold text-sm text-slate-800 hover:text-indigo-600 cursor-pointer mb-1 leading-snug">${task.title}</h4>
            <p class="text-xs text-slate-500 line-clamp-2 mb-3">${task.description || "Không có mô tả"}</p>
            <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <div class="flex items-center gap-1.5">
                    <i class="fa-regular fa-clock"></i>
                    <span>${dueText || "Không hạn"}</span>
                </div>
                <div class="flex items-center gap-1 text-slate-600 font-medium">
                    <i class="fa-regular fa-user text-slate-400"></i>
                    <span>${task.assignee ? task.assignee.username : "Chưa gán"}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function handleQuickStatusChange(taskId, newStatus) {
    const res = await apiCall(`/tasks/${taskId}`, "PUT", { status: newStatus });
    if (res) {
        loadKanbanBoard();
    }
}

async function handleCreateTask(e) {
    e.preventDefault();
    if (!currentWorkspaceId) return;

    const title = document.getElementById("task-title").value.trim();
    const description = document.getElementById("task-desc").value.trim();
    const priority = document.getElementById("task-priority").value;
    const dueDateVal = document.getElementById("task-due-date").value;
    const dueDate = dueDateVal ? new Date(dueDateVal).toISOString() : null;

    const res = await apiCall(`/workspaces/${currentWorkspaceId}/tasks`, "POST", {
        title,
        description,
        priority,
        due_date: dueDate
    });

    if (res) {
        closeModal("create-task-modal");
        document.getElementById("task-title").value = "";
        document.getElementById("task-desc").value = "";
        loadKanbanBoard();
    }
}


// ==========================================
// 6. TASK DETAIL & COLLABORATION (COMMENTS + TIMELINE)
// ==========================================

async function openTaskDetail(taskId) {
    currentTaskId = taskId;
    const task = await apiCall(`/tasks/${taskId}`, "GET");
    if (!task) return;

    document.getElementById("modal-task-title").textContent = task.title;
    document.getElementById("modal-task-desc").textContent = task.description || "Không có mô tả chi tiết";
    document.getElementById("modal-task-priority").textContent = task.priority;
    document.getElementById("modal-task-status").textContent = task.status;
    document.getElementById("modal-task-due").textContent = task.due_date ? new Date(task.due_date).toLocaleString('vi-VN') : "Không có";
    document.getElementById("modal-task-assignee").textContent = task.assignee ? task.assignee.username : "Chưa gán";

    // Mặc định tab Bình luận
    switchTaskDetailTab("comments");
    loadTaskComments(taskId);
    loadTaskActivities(taskId);

    openModal("task-detail-modal");
}

function switchTaskDetailTab(subTab) {
    const commentsPanel = document.getElementById("task-comments-panel");
    const activitiesPanel = document.getElementById("task-activities-panel");
    const commentsBtn = document.getElementById("task-tab-comments-btn");
    const activitiesBtn = document.getElementById("task-tab-activities-btn");
    const commentInput = document.getElementById("task-comment-input-box");

    if (subTab === "comments") {
        commentsPanel.classList.remove("hidden");
        activitiesPanel.classList.add("hidden");
        commentInput.classList.remove("hidden");
        commentsBtn.className = "py-3 px-4 text-xs font-bold text-indigo-600 border-b-2 border-indigo-600";
        activitiesBtn.className = "py-3 px-4 text-xs font-bold text-slate-400 border-b-2 border-transparent hover:text-slate-600";
    } else {
        commentsPanel.classList.add("hidden");
        activitiesPanel.classList.remove("hidden");
        commentInput.classList.add("hidden");
        activitiesBtn.className = "py-3 px-4 text-xs font-bold text-indigo-600 border-b-2 border-indigo-600";
        commentsBtn.className = "py-3 px-4 text-xs font-bold text-slate-400 border-b-2 border-transparent hover:text-slate-600";
    }
}

async function loadTaskComments(taskId) {
    const comments = await apiCall(`/tasks/${taskId}/comments`, "GET");
    const container = document.getElementById("comments-container");
    container.innerHTML = "";

    if (!comments || comments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-xs text-slate-400">
                <i class="fa-regular fa-comment-dots text-3xl mb-2 text-slate-300"></i>
                <p>Chưa có bình luận nào. Hãy bắt đầu cuộc trò chuyện!</p>
            </div>
        `;
        return;
    }

    const currentUser = getCurrentUser();

    comments.forEach(c => {
        const item = document.createElement("div");
        item.className = "flex gap-3 text-sm";
        const dateStr = new Date(c.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const isMyComment = currentUser && c.user && currentUser.email === c.user.email;

        item.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                ${(c.user ? c.user.username : "U").charAt(0).toUpperCase()}
            </div>
            <div class="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-bold text-xs text-slate-800">${c.user ? c.user.username : "Thành viên"}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] text-slate-400">${dateStr}</span>
                        ${isMyComment ? `
                            <button onclick="handleDeleteComment(${c.id})" class="text-slate-400 hover:text-rose-600" title="Xóa bình luận">
                                <i class="fa-regular fa-trash-can text-xs"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <p class="text-xs text-slate-700 whitespace-pre-line">${c.content}</p>
            </div>
        `;
        container.appendChild(item);
    });
}

async function handleSendComment() {
    const input = document.getElementById("new-comment-content");
    const content = input.value.trim();
    if (!content || !currentTaskId) return;

    const res = await apiCall(`/tasks/${currentTaskId}/comments`, "POST", { content });
    if (res) {
        input.value = "";
        loadTaskComments(currentTaskId);
        loadTaskActivities(currentTaskId); // Hoạt động mới sẽ tự động sinh ra
    }
}

async function handleDeleteComment(commentId) {
    if (!confirm("Bạn có chắc chắn muốn xóa bình luận này?")) return;
    const res = await apiCall(`/comments/${commentId}`, "DELETE");
    if (res) {
        loadTaskComments(currentTaskId);
        loadTaskActivities(currentTaskId);
    }
}

async function loadTaskActivities(taskId) {
    const activities = await apiCall(`/tasks/${taskId}/activities`, "GET");
    const container = document.getElementById("activities-container");
    container.innerHTML = "";

    if (!activities || activities.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Chưa có lịch sử hoạt động.</p>`;
        return;
    }

    activities.forEach(a => {
        const item = document.createElement("div");
        item.className = "flex items-start gap-3 text-xs";
        const timeStr = new Date(a.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

        item.innerHTML = `
            <div class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                <i class="fa-solid fa-bolt text-[10px]"></i>
            </div>
            <div class="flex-1">
                <p class="text-slate-700 font-medium">${a.description}</p>
                <span class="text-[10px] text-slate-400">${timeStr}</span>
            </div>
        `;
        container.appendChild(item);
    });
}


// ==========================================
// 7. LỊCH HỌP FULLCALENDAR (GOOGLE CALENDAR STYLE)
// ==========================================

function initOrRefreshCalendar() {
    const calEl = document.getElementById("calendar-container");

    if (!calendarInstance) {
        calendarInstance = new FullCalendar.Calendar(calEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            locale: 'vi',
            buttonText: {
                today: 'Hôm nay',
                month: 'Tháng',
                week: 'Tuần',
                day: 'Ngày'
            },
            events: async function(info, successCallback, failureCallback) {
                if (!currentWorkspaceId) {
                    successCallback([]);
                    return;
                }
                const url = `/workspaces/${currentWorkspaceId}/meetings?from_date=${info.startStr}&to_date=${info.endStr}`;
                const meetings = await apiCall(url, "GET");
                if (meetings) {
                    const events = meetings.map(m => ({
                        id: m.id,
                        title: m.title,
                        start: m.start_time,
                        end: m.end_time,
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        extendedProps: {
                            description: m.description,
                            creator: m.creator ? m.creator.username : "Owner",
                            meeting_link: m.meeting_link
                        }
                    }));
                    successCallback(events);
                } else {
                    failureCallback();
                }
            },
            eventClick: function(info) {
                openMeetingDetail(info.event);
            }
        });
        calendarInstance.render();
    } else {
        calendarInstance.refetchEvents();
    }
}

function openMeetingDetail(event) {
    currentMeetingId = event.id;
    document.getElementById("md-title").textContent = event.title;
    document.getElementById("md-desc").textContent = event.extendedProps.description || "Không có mô tả cuộc họp";
    document.getElementById("md-creator").textContent = event.extendedProps.creator;
    
    const startStr = new Date(event.start).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const endStr = new Date(event.end).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    document.getElementById("md-time").textContent = `${startStr} - ${endStr}`;

    const joinBtn = document.getElementById("md-join-btn");
    joinBtn.href = event.extendedProps.meeting_link || "#";

    openModal("meeting-detail-modal");
}

async function handleCreateMeeting(e) {
    e.preventDefault();
    if (!currentWorkspaceId) return;

    const title = document.getElementById("meet-title").value.trim();
    const description = document.getElementById("meet-desc").value.trim();
    const startVal = document.getElementById("meet-start").value;
    const endVal = document.getElementById("meet-end").value;
    const meetingLink = document.getElementById("meet-link").value.trim();

    if (new Date(startVal) >= new Date(endVal)) {
        alert("Thời gian kết thúc phải diễn ra sau thời gian bắt đầu!");
        return;
    }

    const payload = {
        title,
        description,
        start_time: new Date(startVal).toISOString(),
        end_time: new Date(endVal).toISOString(),
        meeting_link: meetingLink || null
    };

    const res = await apiCall(`/workspaces/${currentWorkspaceId}/meetings`, "POST", payload);
    if (res) {
        closeModal("create-meeting-modal");
        document.getElementById("meet-title").value = "";
        document.getElementById("meet-desc").value = "";
        document.getElementById("meet-link").value = "";
        if (calendarInstance) calendarInstance.refetchEvents();
    }
}

async function handleDeleteMeeting() {
    if (!currentMeetingId) return;
    if (!confirm("Bạn có chắc chắn muốn hủy cuộc họp này?")) return;

    const res = await apiCall(`/meetings/${currentMeetingId}`, "DELETE");
    if (res) {
        closeModal("meeting-detail-modal");
        if (calendarInstance) calendarInstance.refetchEvents();
    }
}


// ==========================================
// 8. DASHBOARD THỐNG KÊ (SUMMARY - NGƯỜI 3)
// ==========================================

async function loadSummary() {
    if (!currentWorkspaceId) return;

    const data = await apiCall(`/workspaces/${currentWorkspaceId}/summary`, "GET");
    if (!data) return;

    document.getElementById("summary-rate").textContent = `${data.completion_rate}%`;
    document.getElementById("summary-progress-bar").style.width = `${data.completion_rate}%`;
    document.getElementById("sum-total").textContent = data.total_tasks;
    document.getElementById("sum-todo").textContent = data.todo_count;
    document.getElementById("sum-in-progress").textContent = data.in_progress_count;
    document.getElementById("sum-done").textContent = data.done_count;
}


// ==========================================
// 9. QUẢN LÝ THÀNH VIÊN (MEMBERS)
// ==========================================

async function loadMembers() {
    if (!currentWorkspaceId) return;

    const members = await apiCall(`/workspaces/${currentWorkspaceId}/members`, "GET");
    const container = document.getElementById("members-list");
    container.innerHTML = "";

    if (!members || members.length === 0) {
        container.innerHTML = `<p class="p-6 text-sm text-slate-400 text-center">Chưa có thành viên nào được thêm vào Workspace này.</p>`;
        return;
    }

    members.forEach(m => {
        const item = document.createElement("div");
        item.className = "px-6 py-4 flex items-center justify-between";
        const dateStr = new Date(m.joined_at).toLocaleDateString('vi-VN');

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                    #${m.user_id}
                </div>
                <div>
                    <p class="text-sm font-bold text-slate-800">User ID: ${m.user_id}</p>
                    <p class="text-xs text-slate-400">Tham gia ngày: ${dateStr}</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">${m.role}</span>
                <button onclick="handleRemoveMember(${m.user_id})" class="text-rose-600 hover:text-rose-800 text-xs font-semibold py-1 px-2.5 rounded-lg hover:bg-rose-50 transition">Xóa</button>
            </div>
        `;
        container.appendChild(item);
    });
}

async function handleAddMember(e) {
    e.preventDefault();
    if (!currentWorkspaceId) return;

    const userId = parseInt(document.getElementById("new-member-userid").value);
    const res = await apiCall(`/workspaces/${currentWorkspaceId}/members`, "POST", { user_id: userId });
    if (res) {
        document.getElementById("new-member-userid").value = "";
        loadMembers();
    }
}

async function handleRemoveMember(userId) {
    if (!confirm(`Bạn có chắc muốn xóa thành viên #${userId} khỏi workspace?`)) return;
    const res = await apiCall(`/workspaces/${currentWorkspaceId}/members/${userId}`, "DELETE");
    if (res) {
        loadMembers();
    }
}


// ==========================================
// 10. MODAL UTILITIES
// ==========================================

function openModal(id) {
    document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
}
