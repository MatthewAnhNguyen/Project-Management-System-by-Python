/**
 * ProjectManage - Frontend Controller (Linear/Modern SaaS Dashboard Style)
 * Kết nối REST API FastAPI
 */

const API_BASE = (window.location.port === "8000") ? "" : "http://127.0.0.1:8000";

let currentWorkspaceId = null;
let allWorkspaces = [];
let currentWorkspaceTasks = [];
let currentTaskId = null;
let currentMeetingId = null;
let calendarInstance = null;
let activeSidebarView = "home";
let currentCalendarFilter = "ALL"; // ALL, MEETING, TASK_DEADLINE
let calendarModalType = "MEETING";  // MEETING or TASK
let calendarModalMode = "CREATE";   // CREATE or EDIT_MEETING
let currentMeetingData = null;
let currentTaskData = null;

// ==========================================
// 1. QUẢN LÝ AUTHENTICATION & API CALL
// ==========================================

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
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        if (response.status === 401) {
            // Nếu đang gọi API đăng nhập / xác thực: hiển thị đúng thông báo lỗi từ backend
            if (endpoint.startsWith("/auth/")) {
                let errorMsg = "Email hoặc mật khẩu không chính xác!";
                try {
                    const errData = await response.json();
                    if (errData && errData.detail) errorMsg = errData.detail;
                } catch (e) {}
                alert(errorMsg + "\n(Nếu bạn chưa đăng ký tài khoản trên thư mục này, vui lòng chuyển sang tab 'Đăng ký')");
                return null;
            }
            // Chỉ cảnh báo hết hạn và logout khi đang trong phiên làm việc của user đã đăng nhập
            if (getToken()) {
                alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
                handleLogout();
            }
            return null;
        }
        if (response.status === 204) {
            return true;
        }
        const data = await response.json();
        if (!response.ok) {
            alert(data.detail || "Đã xảy ra lỗi, vui lòng kiểm tra lại!");
            return null;
        }
        return data;
    } catch (err) {
        console.error("API Error:", err);
        alert("Không thể kết nối đến máy chủ FastAPI Backend! Hãy chắc chắn server đang chạy tại port 8000.");
        return null;
    }
}


// ==========================================
// 2. KHỞI CHẠY ỨNG DỤNG & AUTH FLOW
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    checkAuthState();
});

async function checkAuthState() {
    const token = getToken();
    const user = getCurrentUser();
    const authScreen = document.getElementById("auth-screen");

    if (token && user) {
        // Kiểm tra xem token này có thực sự hợp lệ với backend và database hiện tại không
        const profile = await fetchUserProfile(token);
        if (!profile) {
            // Token đã hết hạn hoặc database mới chưa có user này -> xóa auth cũ trong im lặng
            clearAuth();
            authScreen.classList.remove("hidden");
            return;
        }

        authScreen.classList.add("hidden");
        // Lưu thông tin người dùng đầy đủ bao gồm ID vào localStorage
        setAuth(token, profile);

        const displayName = profile.username || user.username || "User";
        const myUserId = profile.id || user.id || "";

        document.getElementById("user-display-name").textContent = displayName;
        document.getElementById("banner-username").textContent = displayName.split(" ")[0] || displayName;
        document.getElementById("user-display-email").textContent = profile.email || user.email || "";
        document.getElementById("user-avatar-initial").textContent = displayName.substring(0, 2).toUpperCase();

        // Hiển thị thông tin vào Dropdown mở rộng (chứa User ID chuỗi ngẫu nhiên)
        const dropdownIdEl = document.getElementById("dropdown-user-id");
        if (dropdownIdEl) dropdownIdEl.textContent = myUserId;
        const dropdownNameEl = document.getElementById("dropdown-user-name");
        if (dropdownNameEl) dropdownNameEl.textContent = displayName;
        const dropdownEmailEl = document.getElementById("dropdown-user-email");
        if (dropdownEmailEl) dropdownEmailEl.textContent = profile.email || user.email || "";
        const dropdownAvatarEl = document.getElementById("dropdown-avatar-initial");
        if (dropdownAvatarEl) dropdownAvatarEl.textContent = displayName.substring(0, 2).toUpperCase();

        loadAllData();
    } else {
        authScreen.classList.remove("hidden");
    }
}

function toggleProfileDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById("user-profile-dropdown");
    const chevron = document.getElementById("profile-chevron");
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains("hidden");
    if (isHidden) {
        dropdown.classList.remove("hidden");
        if (chevron) chevron.classList.add("rotate-180");
    } else {
        dropdown.classList.add("hidden");
        if (chevron) chevron.classList.remove("rotate-180");
    }
}

// Tự động đóng Profile Dropdown khi click ra ngoài
document.addEventListener("click", function(event) {
    const dropdown = document.getElementById("user-profile-dropdown");
    const btn = document.getElementById("user-profile-btn");
    const chevron = document.getElementById("profile-chevron");
    if (dropdown && !dropdown.classList.contains("hidden")) {
        if (!dropdown.contains(event.target) && (!btn || !btn.contains(event.target))) {
            dropdown.classList.add("hidden");
            if (chevron) chevron.classList.remove("rotate-180");
        }
    }
});

function showAuthTab(tab) {
    const loginForm = document.getElementById("login-form");
    const regForm = document.getElementById("register-form");
    const tabLoginBtn = document.getElementById("tab-login-btn");
    const tabRegBtn = document.getElementById("tab-register-btn");

    if (tab === "login") {
        loginForm.classList.remove("hidden");
        regForm.classList.add("hidden");
        tabLoginBtn.className = "flex-1 pb-3 text-sm font-semibold text-blue-600 border-b-2 border-blue-600";
        tabRegBtn.className = "flex-1 pb-3 text-sm font-semibold text-slate-400 border-b-2 border-transparent hover:text-slate-600";
    } else {
        loginForm.classList.add("hidden");
        regForm.classList.remove("hidden");
        tabRegBtn.className = "flex-1 pb-3 text-sm font-semibold text-blue-600 border-b-2 border-blue-600";
        tabLoginBtn.className = "flex-1 pb-3 text-sm font-semibold text-slate-400 border-b-2 border-transparent hover:text-slate-600";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    const data = await apiCall("/auth/login", "POST", { email, password });
    if (data && data.access_token) {
        const user = await fetchUserProfile(data.access_token);
        if (user) {
            setAuth(data.access_token, user);
            checkAuthState();
        }
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;

    const data = await apiCall("/auth/register", "POST", { username, email, password });
    if (data) {
        alert("Đăng ký thành công! Hãy đăng nhập.");
        showAuthTab("login");
    }
}

async function fetchUserProfile(token) {
    try {
        const res = await fetch(`${API_BASE}/users/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (err) {
        console.error(err);
    }
    return null;
}

function handleLogout() {
    clearAuth();
    window.location.reload();
}


// ==========================================
// 3. ĐIỀU HƯỚNG SIDEBAR VIEWS
// ==========================================

function switchSidebarView(view) {
    activeSidebarView = view;
    const views = ["home", "projects", "calendar", "mytasks", "team", "activities"];

    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        const btn = document.getElementById(`nav-${v}`);
        if (el) el.classList.add("hidden");
        if (btn) {
            btn.className = "w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition";
        }
    });

    const activeEl = document.getElementById(`view-${view}`);
    const activeBtn = document.getElementById(`nav-${view}`);
    if (activeEl) activeEl.classList.remove("hidden");
    if (activeBtn) {
        activeBtn.className = "w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-50 text-blue-600 transition";
    }

    if (view === "home") {
        renderProjectCards(allWorkspaces);
    } else if (view === "projects") {
        loadWorkspaceDetails();
    } else if (view === "calendar") {
        initOrRefreshCalendar();
        setTimeout(() => {
            if (calendarInstance) calendarInstance.updateSize();
        }, 60);
    } else if (view === "mytasks") {
        loadMyTasks();
    } else if (view === "team") {
        loadMembers();
    } else if (view === "activities") {
        loadFullActivities();
    }
}

function openProjectView(wsId) {
    currentWorkspaceId = wsId;
    switchSidebarView("projects");
    renderProjectDropdownMenu(allWorkspaces);
    loadWorkspaceDetails();
}


// ==========================================
// 4. QUẢN LÝ DỮ LIỆU WORKSPACE & DASHBOARD
// ==========================================

async function loadAllData() {
    await loadWorkspaces();
    loadMyTasksCount();
}

async function loadWorkspaces() {
    const workspaces = await apiCall("/workspaces", "GET");
    allWorkspaces = workspaces || [];

    // KPI Total Projects
    document.getElementById("kpi-total-projects").textContent = allWorkspaces.length;

    if (allWorkspaces.length === 0) {
        renderProjectCards([]);
        document.getElementById("current-board-project-name").textContent = "Chưa có dự án nào";
        return;
    }

    if (!currentWorkspaceId || !allWorkspaces.some(w => String(w.id) === String(currentWorkspaceId))) {
        currentWorkspaceId = allWorkspaces[0].id;
    }

    renderProjectCards(allWorkspaces);
    renderProjectDropdownMenu(allWorkspaces);
    loadWorkspaceDetails();
}

function renderProjectCards(workspaces) {
    const container = document.getElementById("projects-grid-container");
    if (!container) return;
    container.innerHTML = "";

    if (!workspaces || workspaces.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
                <i class="fa-regular fa-folder-open text-3xl text-slate-300 mb-2"></i>
                <p class="text-xs font-bold text-slate-500">Chưa có dự án nào.</p>
                <button onclick="openModal('create-workspace-modal')" class="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition">Tạo dự án mới</button>
            </div>
        `;
        return;
    }

    const cardStyles = [
        { bg: "bg-blue-50", text: "text-blue-600", icon: "fa-solid fa-shapes" },
        { bg: "bg-purple-50", text: "text-purple-600", icon: "fa-solid fa-layer-group" },
        { bg: "bg-emerald-50", text: "text-emerald-600", icon: "fa-solid fa-code" },
        { bg: "bg-amber-50", text: "text-amber-600", icon: "fa-solid fa-laptop-code" },
        { bg: "bg-rose-50", text: "text-rose-600", icon: "fa-solid fa-diagram-project" }
    ];

    const currentUser = getCurrentUser();

    workspaces.forEach((ws, idx) => {
        const style = cardStyles[idx % cardStyles.length];
        const isSelected = String(ws.id) === String(currentWorkspaceId);
        const isOwner = currentUser && (String(ws.owner_id) === String(currentUser.id));
        const progressPct = ws.completion_rate !== undefined ? ws.completion_rate : 0;
        const totalTasks = ws.total_tasks || 0;
        const doneTasks = ws.done_tasks || 0;

        const card = document.createElement("div");
        card.className = `bg-white p-5 rounded-2xl border transition cursor-pointer hover:shadow-md hover:border-blue-400 space-y-4 flex flex-col justify-between ${
            isSelected ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200/80'
        }`;
        card.onclick = () => openProjectView(ws.id);

        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <div class="w-10 h-10 rounded-xl ${style.bg} ${style.text} flex items-center justify-center text-sm font-bold shadow-xs">
                        <i class="${style.icon}"></i>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">#${ws.id}</span>
                        ${isOwner ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Owner</span>' : ''}
                    </div>
                </div>
                <div>
                    <h4 class="font-extrabold text-base text-slate-900 truncate leading-snug">${ws.name}</h4>
                    <p class="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed whitespace-pre-line">
                        ${ws.description ? ws.description : '<span class="italic text-slate-400">Không có mô tả chi tiết.</span>'}
                    </p>
                </div>
            </div>
            <div class="pt-3 border-t border-slate-100">
                <div class="flex items-center justify-between text-xs mb-1.5 font-bold">
                    <span class="text-slate-500 font-medium">Tiến độ</span>
                    <span class="text-slate-700">${progressPct}% <span class="text-[11px] text-slate-400 font-normal">(${doneTasks}/${totalTasks} tasks)</span></span>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div class="bg-blue-600 h-full rounded-full transition-all duration-500" style="width: ${progressPct}%"></div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderProjectDropdownMenu(workspaces) {
    const list = document.getElementById("project-dropdown-list");
    list.innerHTML = "";

    workspaces.forEach(ws => {
        const item = document.createElement("button");
        item.className = `w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
            String(ws.id) === String(currentWorkspaceId) ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
        }`;
        item.onclick = () => {
            selectWorkspace(ws.id);
            toggleProjectSelectMenu();
        };
        item.innerHTML = `
            <span class="truncate">${ws.name}</span>
            <span class="text-[10px] text-slate-400 font-mono">#${ws.id}</span>
        `;
        list.appendChild(item);
    });
}

function toggleProjectSelectMenu() {
    const menu = document.getElementById("project-dropdown-menu");
    menu.classList.toggle("hidden");
}

function selectWorkspace(wsId) {
    currentWorkspaceId = wsId;
    renderProjectCards(allWorkspaces);
    renderProjectDropdownMenu(allWorkspaces);
    loadWorkspaceDetails();
    if (calendarInstance) {
        calendarInstance.refetchEvents();
    }
}

async function loadWorkspaceDetails() {
    if (!currentWorkspaceId) return;

    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    if (currentWs) {
        document.getElementById("current-board-project-name").textContent = currentWs.name;
        const idBadge = document.getElementById("current-board-project-id");
        if (idBadge) idBadge.textContent = `ID: #${currentWs.id}`;

        const ownerBadge = document.getElementById("current-board-owner-badge");
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
        if (ownerBadge) {
            ownerBadge.textContent = isOwner ? "Owner (Bạn)" : `Chủ dự án #${currentWs.owner_id}`;
            ownerBadge.className = isOwner 
                ? "text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800"
                : "text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700";
        }

        // Ẩn/Hiện nút Add Task & Lên lịch cho Member
        const boardAddBtn = document.getElementById("board-add-task-btn");
        if (boardAddBtn) {
            if (isOwner) boardAddBtn.classList.remove("hidden");
            else boardAddBtn.classList.add("hidden");
        }
        const calCreateBtn = document.getElementById("cal-create-event-btn");
        if (calCreateBtn) {
            if (isOwner) calCreateBtn.classList.remove("hidden");
            else calCreateBtn.classList.add("hidden");
        }

        const descEl = document.getElementById("current-board-project-desc");
        if (descEl) {
            descEl.textContent = currentWs.description || "Dự án này chưa có mô tả chi tiết.";
        }
    }

    // 1. Tải Summary Stats
    const summary = await apiCall(`/workspaces/${currentWorkspaceId}/summary`, "GET");
    if (summary) {
        document.getElementById("kpi-total-tasks").textContent = summary.total_tasks || 0;
        document.getElementById("kpi-overdue-tasks").textContent = summary.todo_count || 0;

        // Cập nhật Donut Chart Widget
        updateDonutChart(summary);
    }

    // 2. Tải Team Members Count
    const members = await apiCall(`/workspaces/${currentWorkspaceId}/members`, "GET");
    if (members) {
        document.getElementById("kpi-team-members").textContent = members.length || 0;
    }

    // 3. Tải Tasks của Project
    const tasks = await apiCall(`/workspaces/${currentWorkspaceId}/tasks`, "GET");
    currentWorkspaceTasks = tasks || [];
    renderKanbanColumns(currentWorkspaceTasks);
    renderUpcomingDeadlinesWidget(currentWorkspaceTasks);

    // 4. Tải Recent Activities
    loadRecentActivitiesWidget();
}

function updateDonutChart(summary) {
    const total = summary.total_tasks || 0;
    const done = summary.done_count || 0;
    const inProgress = summary.in_progress_count || 0;
    const todo = summary.todo_count || 0;

    document.getElementById("progress-donut-count").textContent = total;

    const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
    const inProgressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    const todoPct = total > 0 ? Math.round((todo / total) * 100) : 0;

    document.getElementById("legend-done-stat").textContent = `${done} (${donePct}%)`;
    document.getElementById("legend-inprogress-stat").textContent = `${inProgress} (${inProgressPct}%)`;
    document.getElementById("legend-todo-stat").textContent = `${todo} (${todoPct}%)`;

    // SVG dasharray: chu vi là ~97.4 (2 * PI * 15.5)
    const circleDone = document.getElementById("progress-circle-done");
    const circleInProg = document.getElementById("progress-circle-inprogress");

    if (circleDone && circleInProg) {
        circleDone.setAttribute("stroke-dasharray", `${donePct}, 100`);
        circleInProg.setAttribute("stroke-dasharray", `${inProgressPct}, 100`);
        circleInProg.setAttribute("stroke-dashoffset", `-${donePct}`);
    }
}


// ==========================================
// 5. KANBAN TASK BOARD (KHỚP HOÀN TOÀN MOCKUP)
// ==========================================

function renderKanbanColumns(tasks) {
    const colTodo = document.getElementById("col-todo-tasks");
    const colInProg = document.getElementById("col-inprogress-tasks");
    const colReview = document.getElementById("col-review-tasks");
    const colDone = document.getElementById("col-done-tasks");

    colTodo.innerHTML = "";
    colInProg.innerHTML = "";
    colReview.innerHTML = "";
    colDone.innerHTML = "";

    const todoList = tasks.filter(t => t.status === "TODO");
    const inProgList = tasks.filter(t => t.status === "IN_PROGRESS");
    const doneList = tasks.filter(t => t.status === "DONE");
    const reviewList = tasks.filter(t => t.status === "CANCELLED" || t.status === "REVIEW");

    document.getElementById("badge-todo").textContent = todoList.length;
    document.getElementById("badge-inprogress").textContent = inProgList.length;
    document.getElementById("badge-review").textContent = reviewList.length;
    document.getElementById("badge-done").textContent = doneList.length;

    todoList.forEach(t => colTodo.appendChild(createTaskCardElement(t)));
    inProgList.forEach(t => colInProg.appendChild(createTaskCardElement(t)));
    reviewList.forEach(t => colReview.appendChild(createTaskCardElement(t)));
    doneList.forEach(t => colDone.appendChild(createTaskCardElement(t)));
}

function createTaskCardElement(task) {
    const card = document.createElement("div");
    card.className = "task-card bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-sm space-y-2.5 cursor-pointer";
    card.onclick = () => openTaskDetail(task.id);

    // Priority badge
    let priorityClass = "badge-low";
    let priorityDot = "bg-emerald-500";
    if (task.priority === "HIGH") {
        priorityClass = "badge-high";
        priorityDot = "bg-orange-500";
    } else if (task.priority === "URGENT") {
        priorityClass = "badge-urgent";
        priorityDot = "bg-rose-500";
    } else if (task.priority === "MEDIUM") {
        priorityClass = "badge-medium";
        priorityDot = "bg-blue-500";
    }

    // Date
    let dateStr = "No date";
    if (task.due_date) {
        const d = parseUTCDate(task.due_date) || new Date(task.due_date);
        dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Assignee
    const assigneeInitial = (task.assignee && task.assignee.username)
        ? task.assignee.username.substring(0, 1).toUpperCase()
        : "?";

    // Phân quyền đổi trạng thái nhanh: CHỈ OWNER
    const currentWs = allWorkspaces.find(w => String(w.id) === String(task.workspace_id || currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    const canChangeStatus = isOwner;

    card.innerHTML = `
        <h5 class="font-bold text-xs text-slate-800 leading-snug line-clamp-2">${task.title}</h5>
        <div class="flex items-center gap-1.5 flex-wrap">
            <span class="${priorityClass} text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span class="w-1 h-1 rounded-full ${priorityDot}"></span> ${task.priority}
            </span>
        </div>
        <div class="flex items-center justify-between pt-1 text-[11px] text-slate-400 font-medium">
            <span>${dateStr}</span>
            <div class="flex items-center gap-1.5">
                <select onclick="event.stopPropagation()" onchange="handleQuickTaskStatusChange(${task.id}, this.value, event)" ${!canChangeStatus ? 'disabled title="Chỉ Chủ sở hữu (Owner) mới có quyền đổi trạng thái"' : ''} class="text-[10px] font-bold py-0.5 px-1.5 rounded-lg border border-slate-200 ${canChangeStatus ? 'bg-slate-50 text-slate-700 hover:border-blue-400 cursor-pointer' : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-75'} focus:outline-none">
                    <option value="TODO" ${task.status === 'TODO' ? 'selected' : ''}>TODO</option>
                    <option value="IN_PROGRESS" ${task.status === 'IN_PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
                    <option value="REVIEW" ${task.status === 'REVIEW' ? 'selected' : ''}>REVIEW</option>
                    <option value="DONE" ${task.status === 'DONE' ? 'selected' : ''}>DONE</option>
                    <option value="CANCELLED" ${task.status === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
                </select>
                <div class="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[9px] flex items-center justify-center shrink-0" title="${task.assignee ? task.assignee.username : 'Chưa gán'}">
                    ${assigneeInitial}
                </div>
            </div>
        </div>
    `;
    return card;
}

function filterBoardTasks(keyword) {
    const q = keyword.toLowerCase().trim();
    if (!q) {
        renderKanbanColumns(currentWorkspaceTasks);
        return;
    }
    const filtered = currentWorkspaceTasks.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
    renderKanbanColumns(filtered);
}

function handleGlobalSearch(keyword) {
    filterBoardTasks(keyword);
}


// ==========================================
// 6. RIGHT SIDEBAR WIDGETS
// ==========================================

// Helper chuẩn hóa ngày giờ UTC từ SQLite / Backend sang Date Object địa phương
function parseUTCDate(dateStr) {
    if (!dateStr) return null;
    let s = String(dateStr).trim();
    if (!s.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(s)) {
        s = s.replace(" ", "T") + "Z";
    }
    return new Date(s);
}

async function loadRecentActivitiesWidget() {
    if (!currentWorkspaceId) return;
    const container = document.getElementById("recent-activity-list");
    if (!container) return;
    container.innerHTML = "";

    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const currentUser = getCurrentUser();

    // KIỂM TRA QUYỀN OWNER: Chỉ chủ sở hữu dự án mới thấy
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id) === String(currentUser.id));
    if (!isOwner) {
        container.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center italic"><i class="fa-solid fa-lock text-[10px] mr-1"></i> Chỉ chủ sở hữu dự án mới có quyền xem hoạt động.</p>`;
        return;
    }

    const activities = await apiCall(`/workspaces/${currentWorkspaceId}/activities`, "GET");
    if (!activities || activities.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 py-2">Chưa có hoạt động nào gần đây.</p>`;
        return;
    }

    // Top 5 items
    activities.slice(0, 5).forEach(act => {
        const item = document.createElement("div");
        item.className = "flex items-start gap-3";
        const timeStr = formatRelativeTime(act.created_at);
        const initial = (act.user && act.user.username) ? act.user.username.charAt(0).toUpperCase() : 'U';

        item.innerHTML = `
            <div class="w-7 h-7 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                ${initial}
            </div>
            <div class="flex-1 leading-snug">
                <p class="text-xs text-slate-800 font-medium">
                    ${act.description}
                </p>
                <span class="text-[10px] text-slate-400">${timeStr}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderUpcomingDeadlinesWidget(tasks) {
    const container = document.getElementById("upcoming-deadlines-list");
    container.innerHTML = "";

    const tasksWithDeadline = tasks.filter(t => t.due_date).slice(0, 4);
    if (tasksWithDeadline.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 py-2">No upcoming deadlines.</p>`;
        return;
    }

    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const wsName = currentWs ? currentWs.name : "Project";

    tasksWithDeadline.forEach(t => {
        const d = parseUTCDate(t.due_date) || new Date(t.due_date);
        const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
        const dayStr = d.getDate();

        const item = document.createElement("div");
        item.className = "flex items-center gap-3.5 cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition";
        item.onclick = () => openTaskDetail(t.id);

        item.innerHTML = `
            <div class="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex flex-col items-center justify-center text-center shrink-0">
                <span class="text-[8px] font-black uppercase text-rose-500 leading-none">${monthStr}</span>
                <span class="text-xs font-black text-rose-600 leading-none mt-0.5">${dayStr}</span>
            </div>
            <div class="flex-1 truncate">
                <h5 class="text-xs font-bold text-slate-800 truncate">${t.title}</h5>
                <p class="text-[10px] text-slate-400 truncate">${wsName}</p>
            </div>
        `;
        container.appendChild(item);
    });
}

function formatRelativeTime(dateStr) {
    if (!dateStr) return "vừa xong";
    const now = new Date();
    const past = parseUTCDate(dateStr);
    if (!past || isNaN(past.getTime())) return "vừa xong";
    const diffMin = Math.round((now - past) / 60000);

    if (diffMin < 1) return "vừa xong";
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} ngày trước`;
}


// ==========================================
// 7. TASK DETAIL MODAL (COMMENTS & AUDIT LOG)
// ==========================================

async function openTaskDetail(taskId) {
    currentTaskId = taskId;
    const task = await apiCall(`/tasks/${taskId}`, "GET");
    if (!task) return;
    currentTaskData = task;

    document.getElementById("modal-task-id").textContent = `#${task.id}`;
    document.getElementById("modal-task-title").textContent = task.title;
    document.getElementById("modal-task-desc").textContent = task.description || "Không có mô tả chi tiết.";
    
    // Đồng bộ select trạng thái và pills
    const statusSelect = document.getElementById("modal-task-status-select");
    if (statusSelect) {
        statusSelect.value = task.status;
    }
    const legacyStatusEl = document.getElementById("modal-task-status");
    if (legacyStatusEl) {
        legacyStatusEl.textContent = task.status;
    }
    updateModalStatusPills(task.status);

    document.getElementById("modal-task-priority").textContent = task.priority;

    if (task.due_date) {
        const d = parseUTCDate(task.due_date);
        document.getElementById("modal-task-due").textContent = d ? d.toLocaleString('vi-VN') : "Chưa đặt";
    } else {
        document.getElementById("modal-task-due").textContent = "Chưa đặt";
    }

    // Đổ danh sách người làm và chọn người hiện tại
    await populateTaskAssigneeSelect("detail-task-assignee-select", task.assignee_id);

    // Phân quyền trong Modal chi tiết:
    const currentWs = allWorkspaces.find(w => String(w.id) === String(task.workspace_id || currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    const canChangeStatus = isOwner;

    // Nút xóa task & nút chuyển cuộc họp: chỉ Owner mới thấy
    const delBtn = document.getElementById("modal-delete-task-btn");
    if (delBtn) {
        if (isOwner) delBtn.classList.remove("hidden");
        else delBtn.classList.add("hidden");
    }
    const convertBtn = document.getElementById("modal-convert-meeting-btn");
    if (convertBtn) {
        if (isOwner) convertBtn.classList.remove("hidden");
        else convertBtn.classList.add("hidden");
    }

    // Assignee dropdown: Chỉ Owner mới được phân công lại
    const assigneeSelect = document.getElementById("detail-task-assignee-select");
    if (assigneeSelect) {
        assigneeSelect.disabled = !isOwner;
        if (!isOwner) {
            assigneeSelect.classList.add("opacity-70", "cursor-not-allowed");
            assigneeSelect.title = "Chỉ Owner của Workspace mới có quyền phân công người làm";
        } else {
            assigneeSelect.classList.remove("opacity-70", "cursor-not-allowed");
            assigneeSelect.title = "Chọn người thực hiện";
        }
    }

    // Status select và status pills: Chỉ Owner mới được chuyển
    if (statusSelect) {
        statusSelect.disabled = !canChangeStatus;
        if (!canChangeStatus) {
            statusSelect.classList.add("opacity-70", "cursor-not-allowed");
            statusSelect.title = "Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền cập nhật trạng thái";
        } else {
            statusSelect.classList.remove("opacity-70", "cursor-not-allowed");
            statusSelect.title = "";
        }
    }
    ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'].forEach(st => {
        const pill = document.getElementById(`pill-${st}`);
        if (pill) {
            pill.disabled = !canChangeStatus;
            if (!canChangeStatus) {
                pill.classList.add("cursor-not-allowed");
                pill.title = "Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền cập nhật trạng thái";
            } else {
                pill.classList.remove("cursor-not-allowed");
                pill.title = "";
            }
        }
    });

    switchTaskDetailTab("comments");
    loadTaskComments(taskId);
    loadTaskActivities(taskId);
    openModal("task-detail-modal");
}

async function handleReassignTask(newAssigneeId) {
    if (!currentTaskId) return;
    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    if (!isOwner) {
        showToast("Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền phân công người làm!", "error");
        return;
    }
    const assignee = (newAssigneeId && newAssigneeId.trim() !== "") ? String(newAssigneeId).trim() : null;
    const res = await apiCall(`/tasks/${currentTaskId}`, "PUT", { assignee_id: assignee });
    if (res) {
        currentTaskData = res;
        showToast("Đã phân công lại người làm!");
        loadWorkspaceDetails();
        loadTaskActivities(currentTaskId);
        loadRecentActivitiesWidget();
        loadMyTasksCount();
    }
}

async function handleDeleteCurrentTask() {
    if (!currentTaskId) return;
    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    if (!isOwner) {
        showToast("Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền xóa công việc!", "error");
        return;
    }
    const title = currentTaskData ? currentTaskData.title : `#${currentTaskId}`;
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn công việc "${title}"?`)) return;

    const res = await apiCall(`/tasks/${currentTaskId}`, "DELETE");
    if (res !== null) {
        showToast("Đã xóa công việc thành công!");
        closeModal("task-detail-modal");
        currentTaskId = null;
        currentTaskData = null;
        loadWorkspaceDetails();
        loadRecentActivitiesWidget();
        loadMyTasksCount();
    }
}

async function populateTaskAssigneeSelect(selectElementId = "task-assignee", selectedUserId = null) {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Chưa gán cho ai --</option>';

    const targetWsId = currentWorkspaceId;
    if (!targetWsId) return;

    const members = await apiCall(`/workspaces/${targetWsId}/members`, "GET");
    if (members && members.length > 0) {
        members.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.user_id;
            const uname = (m.user && m.user.username) ? m.user.username : `User #${m.user_id}`;
            opt.textContent = `${uname} (${m.role})`;
            if (selectedUserId && String(m.user_id) === String(selectedUserId)) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    }
}

async function convertCurrentTaskToMeeting() {
    if (!currentTaskData) return;
    const task = currentTaskData;
    closeModal("task-detail-modal");

    calendarModalMode = 'CREATE';
    calendarModalType = 'MEETING';

    document.getElementById("cal-modal-title").textContent = "Chuyển Task sang Cuộc họp";
    document.getElementById("cal-modal-subtitle").textContent = "Tạo cuộc họp từ nội dung công việc";
    document.getElementById("cal-type-switcher").classList.add("hidden");
    document.getElementById("cal-submit-btn").innerHTML = '<i class="fa-regular fa-calendar-check mr-1.5"></i> Tạo cuộc họp';

    populateCalendarWorkspaceSelect(task.workspace_id || currentWorkspaceId);

    document.getElementById("meet-title").value = `[Họp] ${task.title}`;
    document.getElementById("meet-desc").value = task.description || "";
    generateAutoJitsiLink();

    let start = task.due_date ? (parseUTCDate(task.due_date) || new Date()) : new Date();
    let end = new Date(start.getTime() + 60 * 60 * 1000);
    document.getElementById("meet-start").value = formatDateTimeLocal(start);
    document.getElementById("meet-end").value = formatDateTimeLocal(end);

    switchCalendarModalTab('MEETING');
    openModal("create-meeting-modal");
}

async function convertCurrentMeetingToTask() {
    if (!currentMeetingData) return;
    const meeting = currentMeetingData;
    closeModal("meeting-detail-modal");

    document.getElementById("task-title").value = meeting.title;
    const descExtra = meeting.meeting_link ? `Link họp: ${meeting.meeting_link}` : "";
    document.getElementById("task-desc").value = meeting.description ? `${meeting.description}\n${descExtra}`.trim() : descExtra;
    
    if (meeting.start) {
        const d = new Date(meeting.start);
        document.getElementById("task-due-date").value = formatDateTimeLocal(d);
    }
    await populateTaskAssigneeSelect("task-assignee");
    openModal("create-task-modal");
}

function updateModalStatusPills(currentStatus) {
    const statuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'];
    statuses.forEach(st => {
        const pill = document.getElementById(`pill-${st}`);
        if (!pill) return;
        if (st === currentStatus) {
            pill.classList.add('ring-2', 'ring-blue-600', 'shadow-xs', 'font-black');
            pill.style.opacity = '1';
        } else {
            pill.classList.remove('ring-2', 'ring-blue-600', 'shadow-xs', 'font-black');
            pill.style.opacity = '0.65';
        }
    });
}

// Xử lý đổi trạng thái task từ bên trong Modal chi tiết
async function handleModalTaskStatusChange(newStatus) {
    if (!currentTaskId) return;
    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentTaskData ? currentTaskData.workspace_id : currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    if (!isOwner) {
        showToast("Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền chuyển trạng thái công việc!", "warning");
        return;
    }
    try {
        const res = await apiCall(`/tasks/${currentTaskId}`, "PUT", { status: newStatus });
        if (res) {
            const statusSelect = document.getElementById("modal-task-status-select");
            if (statusSelect) statusSelect.value = newStatus;
            updateModalStatusPills(newStatus);
            showToast(`Đã chuyển trạng thái sang ${newStatus}`);

            // Cập nhật lại board, widget, timeline và lịch
            if (currentWorkspaceId) {
                loadWorkspaceDetails();
                loadRecentActivitiesWidget();
            }
            loadTaskActivities(currentTaskId);
            if (calendarInstance) {
                calendarInstance.refetchEvents();
            }
            loadMyTasksCount();
            const myTasksTab = document.getElementById("tab-my-tasks");
            if (myTasksTab && !myTasksTab.classList.contains("hidden")) {
                loadMyTasks();
            }
        }
    } catch (err) {
        showToast("Lỗi khi cập nhật trạng thái: " + err.message, "error");
    }
}

// Xử lý đổi trạng thái nhanh từ Kanban Board hoặc My Tasks
async function handleQuickTaskStatusChange(taskId, newStatus, event) {
    if (event) {
        event.stopPropagation();
    }
    const targetTask = currentWorkspaceTasks.find(t => String(t.id) === String(taskId)) || currentTaskData;
    const wsId = targetTask ? targetTask.workspace_id : currentWorkspaceId;
    const currentWs = allWorkspaces.find(w => String(w.id) === String(wsId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    if (!isOwner) {
        showToast("Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền chuyển trạng thái công việc!", "warning");
        if (event && event.target) {
            loadWorkspaceDetails();
        }
        return;
    }
    try {
        const res = await apiCall(`/tasks/${taskId}`, "PUT", { status: newStatus });
        if (res) {
            showToast(`Đã chuyển task #${taskId} sang ${newStatus}`);
            if (currentWorkspaceId) {
                loadWorkspaceDetails();
                loadRecentActivitiesWidget();
            }
            if (calendarInstance) {
                calendarInstance.refetchEvents();
            }
            loadMyTasksCount();
            const myTasksTab = document.getElementById("tab-my-tasks");
            if (myTasksTab && !myTasksTab.classList.contains("hidden")) {
                loadMyTasks();
            }
            // Nếu modal chi tiết của task này đang mở
            if (currentTaskId == taskId) {
                const statusSelect = document.getElementById("modal-task-status-select");
                if (statusSelect) statusSelect.value = newStatus;
                updateModalStatusPills(newStatus);
                loadTaskActivities(taskId);
            }
        }
    } catch (err) {
        showToast("Lỗi khi cập nhật trạng thái: " + err.message, "error");
    }
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
        commentsBtn.className = "py-3 px-4 text-xs font-bold text-blue-600 border-b-2 border-blue-600";
        activitiesBtn.className = "py-3 px-4 text-xs font-bold text-slate-400 border-b-2 border-transparent hover:text-slate-600";
    } else {
        commentsPanel.classList.add("hidden");
        activitiesPanel.classList.remove("hidden");
        commentInput.classList.add("hidden");
        activitiesBtn.className = "py-3 px-4 text-xs font-bold text-blue-600 border-b-2 border-blue-600";
        commentsBtn.className = "py-3 px-4 text-xs font-bold text-slate-400 border-b-2 border-transparent hover:text-slate-600";
    }
}

async function loadTaskComments(taskId) {
    const comments = await apiCall(`/tasks/${taskId}/comments`, "GET");
    const container = document.getElementById("comments-container");
    container.innerHTML = "";

    if (!comments || comments.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">Chưa có bình luận nào.</p>`;
        return;
    }

    const currentUser = getCurrentUser();

    comments.forEach(c => {
        const item = document.createElement("div");
        item.className = "flex gap-3 text-sm";
        const d = parseUTCDate(c.created_at);
        const dateStr = d ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : new Date(c.created_at).toLocaleString();
        const isMyComment = currentUser && (String(currentUser.id) === String(c.user_id));

        item.innerHTML = `
            <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                ${(c.user ? c.user.username : "U").charAt(0).toUpperCase()}
            </div>
            <div class="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-bold text-xs text-slate-800">${c.user ? c.user.username : "Thành viên"}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] text-slate-400">${dateStr}</span>
                        ${isMyComment ? `
                            <button onclick="handleDeleteComment('${c.id}')" class="text-slate-400 hover:text-rose-600">
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
        loadTaskActivities(currentTaskId);
    }
}

async function handleDeleteComment(commentId) {
    if (!confirm("Bạn có chắc muốn xóa bình luận này?")) return;
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
        const d = parseUTCDate(a.created_at);
        const timeStr = d ? d.toLocaleString('vi-VN') : new Date(a.created_at).toLocaleString();

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
// 8. TẠO TASK, WORKSPACE, CUỘC HỌP
// ==========================================

async function handleCreateTask(e) {
    e.preventDefault();
    if (!currentWorkspaceId) return;

    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    if (!isOwner) {
        showToast("Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền tạo và gán công việc!", "error");
        return;
    }

    const title = document.getElementById("task-title").value.trim();
    const description = document.getElementById("task-desc").value.trim();
    const priority = document.getElementById("task-priority").value;
    const dueVal = document.getElementById("task-due-date").value;
    const assigneeVal = document.getElementById("task-assignee") ? document.getElementById("task-assignee").value : null;

    const payload = {
        title,
        description: description || null,
        priority,
        status: "TODO",
        due_date: dueVal ? new Date(dueVal).toISOString() : null,
        assignee_id: (assigneeVal && assigneeVal.trim() !== "") ? String(assigneeVal).trim() : null
    };

    const res = await apiCall(`/workspaces/${currentWorkspaceId}/tasks`, "POST", payload);
    if (res) {
        closeModal("create-task-modal");
        document.getElementById("task-title").value = "";
        document.getElementById("task-desc").value = "";
        document.getElementById("task-due-date").value = "";
        if (document.getElementById("task-assignee")) {
            document.getElementById("task-assignee").value = "";
        }
        showToast("Đã tạo task mới thành công!");
        loadWorkspaceDetails();
        loadRecentActivitiesWidget();
    }
}

async function handleCreateWorkspace(e) {
    e.preventDefault();
    const name = document.getElementById("ws-name").value.trim();
    const description = document.getElementById("ws-desc").value.trim();

    const res = await apiCall("/workspaces", "POST", { name, description });
    if (res) {
        closeModal("create-workspace-modal");
        document.getElementById("ws-name").value = "";
        document.getElementById("ws-desc").value = "";
        currentWorkspaceId = res.id;
        await loadWorkspaces();
        openProjectView(res.id);
    }
}

async function handleJoinWorkspace(e) {
    e.preventDefault();
    let wsId = document.getElementById("join-ws-id").value.trim();
    if (!wsId) return;
    wsId = wsId.replace("#", "").trim();

    const res = await apiCall(`/workspaces/${wsId}/join`, "POST");
    if (res) {
        showToast("Tham gia dự án thành công!");
        closeModal("join-workspace-modal");
        document.getElementById("join-ws-id").value = "";
        currentWorkspaceId = res.workspace_id || wsId;
        await loadWorkspaces();
        openProjectView(currentWorkspaceId);
    }
}

// Sửa Workspace
function openEditWorkspaceModal() {
    if (!currentWorkspaceId) return;
    const ws = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    if (!ws) return;
    document.getElementById("edit-ws-name").value = ws.name || "";
    document.getElementById("edit-ws-desc").value = ws.description || "";
    openModal("edit-workspace-modal");
}

async function handleUpdateWorkspace(e) {
    e.preventDefault();
    if (!currentWorkspaceId) return;
    const name = document.getElementById("edit-ws-name").value.trim();
    const description = document.getElementById("edit-ws-desc").value.trim();
    if (!name) return;

    const res = await apiCall(`/workspaces/${currentWorkspaceId}`, "PUT", { name, description });
    if (res) {
        closeModal("edit-workspace-modal");
        showToast("Đã cập nhật thông tin Workspace!");
        await loadWorkspaces();
    }
}

// Xóa Workspace
async function handleDeleteWorkspace() {
    if (!currentWorkspaceId) return;
    const ws = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const wsName = ws ? ws.name : `#${currentWorkspaceId}`;
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn Workspace "${wsName}"?\nLưu ý: Mọi công việc, cuộc họp và hoạt động của dự án này sẽ bị xóa bỏ!`)) {
        return;
    }

    const res = await apiCall(`/workspaces/${currentWorkspaceId}`, "DELETE");
    if (res) {
        showToast(`Đã xóa Workspace "${wsName}" thành công!`);
        currentWorkspaceId = null;
        await loadWorkspaces();
    }
}

// Đổi mật khẩu
async function handleChangePassword(e) {
    e.preventDefault();
    const oldPassword = document.getElementById("cp-old-password").value;
    const newPassword = document.getElementById("cp-new-password").value;
    const confirmPassword = document.getElementById("cp-confirm-password").value;

    if (newPassword.length < 6) {
        alert("Mật khẩu mới phải có ít nhất 6 ký tự!");
        return;
    }
    if (newPassword !== confirmPassword) {
        alert("Mật khẩu xác nhận không khớp!");
        return;
    }
    if (oldPassword === newPassword) {
        alert("Mật khẩu mới không được trùng với mật khẩu cũ!");
        return;
    }

    const res = await apiCall("/users/me/password", "PUT", {
        old_password: oldPassword,
        new_password: newPassword
    });
    if (res) {
        closeModal("change-password-modal");
        document.getElementById("cp-old-password").value = "";
        document.getElementById("cp-new-password").value = "";
        document.getElementById("cp-confirm-password").value = "";
        showToast("Đổi mật khẩu thành công!");
    }
}


// ==========================================
// 9. LỊCH FULLCALENDAR & MY TASKS
// ==========================================

// Helper hiển thị thông báo nổi Toast (Google Calendar style)
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    const bgClass = type === "success" 
        ? "bg-slate-900 text-white border-slate-700" 
        : (type === "error" ? "bg-rose-600 text-white border-rose-500" : "bg-blue-600 text-white border-blue-500");
    const icon = type === "success" 
        ? "fa-solid fa-check-circle text-emerald-400" 
        : (type === "error" ? "fa-solid fa-circle-exclamation text-rose-200" : "fa-solid fa-info-circle text-blue-200");

    toast.className = `toast-item pointer-events-auto px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-semibold ${bgClass}`;
    toast.innerHTML = `
        <i class="${icon} text-base shrink-0"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-2 text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = "all 0.3s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Helper định dạng ngày giờ cho input datetime-local (YYYY-MM-DDTHH:mm) theo giờ địa phương
function formatDateTimeLocal(d) {
    if (!d) return "";
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initOrRefreshCalendar() {
    const calEl = document.getElementById("calendar-container");

    if (!calendarInstance) {
        calendarInstance = new FullCalendar.Calendar(calEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            locale: 'vi',
            buttonText: {
                today: 'Hôm nay',
                month: 'Tháng',
                week: 'Tuần',
                day: 'Ngày',
                list: 'Lịch biểu'
            },
            // Tính năng Google Calendar:
            navLinks: true,         // Click ngày để phóng to sang chế độ Ngày/Tuần
            selectable: true,       // Bật tính năng click/kéo chọn khung giờ trực tiếp
            selectMirror: true,     // Hiển thị khung tạm thời khi kéo thả chọn giờ
            unselectAuto: true,
            editable: true,         // Kéo thả (drag & drop) dời lịch & co giãn thời lượng
            eventResizableFromStart: false,
            nowIndicator: true,     // Dải màu đỏ đánh dấu mốc giờ hiện tại trên lịch tuần/ngày
            scrollTime: '08:00:00', // Cuộn mặc định tới 8h sáng
            slotMinTime: '06:00:00',
            slotMaxTime: '23:00:00',
            slotDuration: '00:30:00',
            dayMaxEvents: 4,
            eventDisplay: 'block', // Luôn hiển thị dạng thẻ khối đặc (solid block) cho mọi sự kiện

            // SỰ KIỆN 1: Click hoặc kéo chọn ô giờ trên lịch tuần/tháng (Google Calendar Quick Create)
            select: function(selectionInfo) {
                openCreateCalendarEventModal(selectionInfo);
            },

            // SỰ KIỆN 2: Lấy dữ liệu sự kiện từ Backend (có hỗ trợ bộ lọc)
            events: async function(info, successCallback, failureCallback) {
                if (!currentWorkspaceId) {
                    successCallback([]);
                    return;
                }
                const url = `/workspaces/${currentWorkspaceId}/calendar-events?from_date=${encodeURIComponent(info.startStr)}&to_date=${encodeURIComponent(info.endStr)}`;
                const eventsData = await apiCall(url, "GET");
                if (eventsData) {
                    let filtered = eventsData;
                    if (currentCalendarFilter !== "ALL") {
                        filtered = eventsData.filter(e => e.event_type === currentCalendarFilter);
                    }

                    const fcEvents = filtered.map(e => {
                        const isMeeting = (e.event_type === 'MEETING');
                        let bg = isMeeting ? '#059669' : '#2563eb';
                        let border = isMeeting ? '#047857' : '#1d4ed8';

                        if (!isMeeting) {
                            if (e.task_priority === 'URGENT') { bg = '#dc2626'; border = '#b91c1c'; }
                            else if (e.task_priority === 'HIGH') { bg = '#ea580c'; border = '#c2410c'; }
                            else if (e.task_priority === 'MEDIUM') { bg = '#2563eb'; border = '#1d4ed8'; }
                            else if (e.task_priority === 'LOW') { bg = '#0284c7'; border = '#0369a1'; }
                        }

                        return {
                            id: e.id,
                            title: e.title,
                            start: e.start_time,
                            end: e.end_time || e.start_time,
                            backgroundColor: bg,
                            borderColor: border,
                            textColor: '#ffffff',
                            allDay: false,
                            extendedProps: e
                        };
                    });
                    successCallback(fcEvents);
                } else {
                    failureCallback();
                }
            },

            // Render giao diện thẻ sự kiện đẹp mắt với icon và màu nền đặc rõ ràng
            eventContent: function(arg) {
                const props = arg.event.extendedProps;
                const isMeeting = (props.event_type === 'MEETING');
                const iconClass = isMeeting ? 'fa-solid fa-video' : 'fa-solid fa-thumbtack';
                const cleanTitle = isMeeting 
                    ? arg.event.title.replace('📅 [Họp] ', '') 
                    : arg.event.title.replace('📌 [Hạn chót] ', '');
                
                const timeText = arg.timeText 
                    ? `<span class="bg-black/20 text-white/95 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 mr-1">${arg.timeText}</span>` 
                    : '';
                const bg = arg.event.backgroundColor || (isMeeting ? '#059669' : '#2563eb');
                const border = arg.event.borderColor || bg;

                const el = document.createElement('div');
                el.className = 'fc-event-badge flex items-center gap-1.5 px-2 py-1 rounded-md text-white text-xs leading-tight w-full max-w-full min-w-0 overflow-hidden font-bold shadow-xs';
                el.style.backgroundColor = bg;
                el.style.border = `1px solid ${border}`;
                el.title = cleanTitle;
                el.innerHTML = `
                    <i class="${iconClass} text-[10px] shrink-0 text-white/90"></i>
                    ${timeText}
                    <span class="font-bold truncate min-w-0 flex-1 text-white leading-tight drop-shadow-xs">${cleanTitle}</span>
                `;
                return { domNodes: [el] };
            },

            // SỰ KIỆN 3: Kéo thả di chuyển sự kiện sang ngày/giờ khác (Drag & Drop)
            eventDrop: async function(info) {
                await handleEventDrop(info);
            },

            // SỰ KIỆN 4: Kéo mép dưới để tăng/giảm thời lượng cuộc họp (Resize)
            eventResize: async function(info) {
                await handleEventResize(info);
            },

            // SỰ KIỆN 5: Click vào sự kiện để xem chi tiết
            eventClick: function(info) {
                const props = info.event.extendedProps;
                if (props.event_type === 'MEETING') {
                    openMeetingDetail(info.event);
                } else {
                    const taskId = props.id.replace('task-', '');
                    openTaskDetail(taskId);
                }
            }
        });
        calendarInstance.render();
        setTimeout(() => {
            if (calendarInstance) calendarInstance.updateSize();
        }, 50);
    } else {
        calendarInstance.refetchEvents();
        setTimeout(() => {
            if (calendarInstance) calendarInstance.updateSize();
        }, 50);
    }
}

// Xử lý kéo thả sự kiện sang giờ/ngày mới
async function handleEventDrop(info) {
    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    if (!isOwner) {
        info.revert();
        showToast("Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền dời lịch!", "warning");
        return;
    }

    const props = info.event.extendedProps;
    const isMeeting = (props.event_type === 'MEETING');
    const rawId = props.id.replace(isMeeting ? 'meeting-' : 'task-', '');
    const newStart = info.event.start;
    const newEnd = info.event.end || new Date(newStart.getTime() + 60 * 60 * 1000);

    try {
        if (isMeeting) {
            const res = await apiCall(`/meetings/${rawId}`, "PUT", {
                start_time: newStart.toISOString(),
                end_time: newEnd.toISOString()
            });
            if (!res) {
                info.revert();
                return;
            }
            const timeStr = newStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const dateStr = newStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            showToast(`Đã dời cuộc họp sang ${timeStr} ngày ${dateStr}`);
        } else {
            const res = await apiCall(`/tasks/${rawId}`, "PUT", {
                due_date: newStart.toISOString()
            });
            if (!res) {
                info.revert();
                return;
            }
            const dateStr = newStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            showToast(`Đã đổi hạn chót task sang ${dateStr}`);
        }
        loadRecentActivitiesWidget();
    } catch (err) {
        info.revert();
        showToast("Lỗi khi dời lịch: " + err.message, "error");
    }
}

// Xử lý kéo dãn thời lượng cuộc họp
async function handleEventResize(info) {
    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    if (!isOwner) {
        info.revert();
        showToast("Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền thay đổi thời lượng!", "warning");
        return;
    }

    const props = info.event.extendedProps;
    if (props.event_type !== 'MEETING') {
        info.revert();
        return;
    }
    const rawId = props.id.replace('meeting-', '');
    const newStart = info.event.start;
    const newEnd = info.event.end;

    try {
        const res = await apiCall(`/meetings/${rawId}`, "PUT", {
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString()
        });
        if (!res) {
            info.revert();
            return;
        }
        const diffMin = Math.round((newEnd - newStart) / 60000);
        showToast(`Đã cập nhật thời lượng họp: ${diffMin} phút`);
        loadRecentActivitiesWidget();
    } catch (err) {
        info.revert();
        showToast("Lỗi khi chỉnh thời lượng: " + err.message, "error");
    }
}

// Chuyển đổi bộ lọc sự kiện trên lịch
function setCalendarFilter(filter) {
    currentCalendarFilter = filter;
    const btns = {
        'ALL': document.getElementById("cal-filter-all"),
        'MEETING': document.getElementById("cal-filter-meetings"),
        'TASK_DEADLINE': document.getElementById("cal-filter-tasks")
    };

    Object.keys(btns).forEach(k => {
        const b = btns[k];
        if (!b) return;
        if (k === filter) {
            b.className = "px-3 py-1.5 rounded-xl bg-white text-blue-600 shadow-sm transition";
        } else {
            b.className = "px-3 py-1.5 rounded-xl hover:text-slate-900 transition";
        }
    });

    if (calendarInstance) {
        calendarInstance.refetchEvents();
    }
}

// Mở Modal tạo lịch (Google Calendar Style) với khung giờ được click / kéo chọn
async function openCreateCalendarEventModal(selectionInfo = null) {
    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
    if (!isOwner) {
        showToast("Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền tạo sự kiện và lên lịch!", "warning");
        if (calendarInstance) calendarInstance.unselect();
        return;
    }

    calendarModalMode = 'CREATE';
    calendarModalType = 'MEETING';

    document.getElementById("cal-modal-title").textContent = "Lên lịch sự kiện mới";
    document.getElementById("cal-modal-subtitle").textContent = "Google Calendar: Chọn giờ và lưu trực tiếp";
    document.getElementById("cal-type-switcher").classList.remove("hidden");
    document.getElementById("cal-submit-btn").innerHTML = '<i class="fa-regular fa-calendar-check mr-1.5"></i> Lưu vào lịch';

    populateCalendarWorkspaceSelect(currentWorkspaceId);

    // Reset các trường
    document.getElementById("meet-title").value = "";
    document.getElementById("meet-desc").value = "";
    document.getElementById("meet-link").value = "";
    document.getElementById("cal-task-desc").value = "";

    // Load danh sách người thực hiện cho Task
    populateCalendarAssigneeSelect();

    if (selectionInfo) {
        let start = new Date(selectionInfo.start);
        let end = selectionInfo.end ? new Date(selectionInfo.end) : null;

        if (selectionInfo.allDay) {
            // Xem theo Tháng (click hoặc kéo ngày)
            start.setHours(9, 0, 0, 0);
            if (!end || end.getTime() <= start.getTime()) {
                end = new Date(start.getTime() + 60 * 60 * 1000);
            } else {
                const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24));
                if (daysDiff <= 1) {
                    end = new Date(start.getTime() + 60 * 60 * 1000);
                } else {
                    end.setDate(end.getDate() - 1);
                    end.setHours(18, 0, 0, 0);
                }
            }
        } else {
            // Xem theo Tuần hoặc Ngày (click hoặc kéo ô giờ chính xác)
            if (!end || end.getTime() === start.getTime()) {
                end = new Date(start.getTime() + 60 * 60 * 1000);
            }
        }

        document.getElementById("meet-start").value = formatDateTimeLocal(start);
        document.getElementById("meet-end").value = formatDateTimeLocal(end);
    } else {
        // Mặc định tới giờ tròn kế tiếp
        const now = new Date();
        now.setMinutes(0, 0, 0);
        now.setHours(now.getHours() + 1);
        const end = new Date(now.getTime() + 60 * 60 * 1000);

        document.getElementById("meet-start").value = formatDateTimeLocal(now);
        document.getElementById("meet-end").value = formatDateTimeLocal(end);
    }

    switchCalendarModalTab('MEETING');
    openModal("create-meeting-modal");

    setTimeout(() => {
        const titleInput = document.getElementById("meet-title");
        if (titleInput) titleInput.focus();
    }, 150);
}

// Chuyển tab giữa Cuộc họp vs Công việc trong Modal
function switchCalendarModalTab(type) {
    calendarModalType = type;
    const tabMeeting = document.getElementById("tab-cal-meeting");
    const tabTask = document.getElementById("tab-cal-task");
    const fieldsMeeting = document.getElementById("cal-fields-meeting");
    const fieldsTask = document.getElementById("cal-fields-task");
    const durationChips = document.getElementById("cal-duration-chips");
    const iconContainer = document.getElementById("cal-modal-icon");

    if (type === 'MEETING') {
        tabMeeting.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-white text-emerald-700 shadow-sm flex items-center justify-center gap-2 transition";
        tabTask.className = "flex-1 py-2 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-800 flex items-center justify-center gap-2 transition";
        fieldsMeeting.classList.remove("hidden");
        fieldsTask.classList.add("hidden");
        durationChips.classList.remove("hidden");
        iconContainer.className = "w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base font-bold shadow-sm";
        iconContainer.innerHTML = '<i class="fa-solid fa-video"></i>';
    } else {
        tabTask.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-white text-blue-700 shadow-sm flex items-center justify-center gap-2 transition";
        tabMeeting.className = "flex-1 py-2 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-800 flex items-center justify-center gap-2 transition";
        fieldsTask.classList.remove("hidden");
        fieldsMeeting.classList.add("hidden");
        durationChips.classList.add("hidden");
        iconContainer.className = "w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-base font-bold shadow-sm";
        iconContainer.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
    }
}

// Đặt thời lượng nhanh (+15p, +30p, +1h...)
function setQuickDuration(minutes) {
    const startInput = document.getElementById("meet-start");
    const endInput = document.getElementById("meet-end");
    if (!startInput || !endInput) return;

    let start = startInput.value ? new Date(startInput.value) : new Date();
    const end = new Date(start.getTime() + minutes * 60000);
    endInput.value = formatDateTimeLocal(end);
}

function onCalendarStartTimeChange() {
    const startInput = document.getElementById("meet-start");
    const endInput = document.getElementById("meet-end");
    if (!startInput || !endInput || !startInput.value) return;

    const start = new Date(startInput.value);
    const end = endInput.value ? new Date(endInput.value) : null;
    if (!end || end <= start) {
        const newEnd = new Date(start.getTime() + 60 * 60000);
        endInput.value = formatDateTimeLocal(newEnd);
    }
}

function generateAutoJitsiLink() {
    const wsId = document.getElementById("cal-modal-workspace").value || currentWorkspaceId || "project";
    const randCode = Math.random().toString(36).substring(2, 8);
    const link = `https://meet.jit.si/pms-ws${wsId}-meet-${randCode}`;
    document.getElementById("meet-link").value = link;
    showToast("Đã tạo link Jitsi Meet tự động!");
}

function populateCalendarWorkspaceSelect(selectedId) {
    const select = document.getElementById("cal-modal-workspace");
    if (!select) return;
    select.innerHTML = "";

    allWorkspaces.forEach(ws => {
        const opt = document.createElement("option");
        opt.value = ws.id;
        opt.textContent = `${ws.name} (#${ws.id})`;
        if (String(ws.id) === String(selectedId)) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
}

async function populateCalendarAssigneeSelect() {
    const select = document.getElementById("cal-task-assignee");
    if (!select || !currentWorkspaceId) return;
    select.innerHTML = '<option value="">-- Chưa gán cho ai --</option>';

    const members = await apiCall(`/workspaces/${currentWorkspaceId}/members`, "GET");
    if (members && members.length > 0) {
        members.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.user_id;
            const uname = (m.user && m.user.username) ? m.user.username : `User #${m.user_id}`;
            opt.textContent = `${uname} (${m.role})`;
            select.appendChild(opt);
        });
    }
}

// Xử lý nộp Form Tạo/Sửa Lịch
async function handleCalendarEventSubmit(e) {
    e.preventDefault();
    const wsId = document.getElementById("cal-modal-workspace").value || currentWorkspaceId;
    if (!wsId) {
        alert("Vui lòng chọn Dự án / Workspace!");
        return;
    }

    const title = document.getElementById("meet-title").value.trim();
    const startVal = document.getElementById("meet-start").value;
    const endVal = document.getElementById("meet-end").value;

    if (!title) {
        alert("Vui lòng nhập tiêu đề!");
        return;
    }

    if (new Date(startVal) >= new Date(endVal)) {
        alert("Thời gian kết thúc phải diễn ra sau thời gian bắt đầu!");
        return;
    }

    // CHẾ ĐỘ SỬA CUỘC HỌP
    if (calendarModalMode === 'EDIT_MEETING') {
        const payload = {
            title,
            description: document.getElementById("meet-desc").value.trim() || null,
            start_time: new Date(startVal).toISOString(),
            end_time: new Date(endVal).toISOString(),
            meeting_link: document.getElementById("meet-link").value.trim() || null
        };
        const res = await apiCall(`/meetings/${currentMeetingId}`, "PUT", payload);
        if (res) {
            closeModal("create-meeting-modal");
            showToast("Đã cập nhật cuộc họp thành công!");
            if (calendarInstance) calendarInstance.refetchEvents();
            loadRecentActivitiesWidget();
        }
        return;
    }

    // CHẾ ĐỘ TẠO MỚI
    if (calendarModalType === 'MEETING') {
        const linkVal = document.getElementById("meet-link").value.trim();
        const payload = {
            title,
            description: document.getElementById("meet-desc").value.trim() || null,
            start_time: new Date(startVal).toISOString(),
            end_time: new Date(endVal).toISOString(),
            meeting_link: linkVal || null
        };
        const res = await apiCall(`/workspaces/${wsId}/meetings`, "POST", payload);
        if (res) {
            closeModal("create-meeting-modal");
            showToast("Đã lên lịch cuộc họp mới thành công!");
            if (calendarInstance) calendarInstance.refetchEvents();
            loadRecentActivitiesWidget();
        }
    } else {
        // TẠO TASK KÈM HẠN CHÓT TRÊN LỊCH
        const priority = document.getElementById("cal-task-priority").value;
        const statusVal = document.getElementById("cal-task-status").value;
        const assigneeEl = document.getElementById("cal-task-assignee");
        const assigneeId = (assigneeEl && assigneeEl.value && assigneeEl.value.trim() !== "")
            ? String(assigneeEl.value).trim()
            : null;
        const desc = document.getElementById("cal-task-desc").value.trim() || null;

        const payload = {
            title,
            description: desc,
            priority,
            status: statusVal,
            due_date: new Date(endVal).toISOString(),
            assignee_id: assigneeId
        };
        const res = await apiCall(`/workspaces/${wsId}/tasks`, "POST", payload);
        if (res) {
            closeModal("create-meeting-modal");
            showToast("Đã tạo công việc và hạn chót trên lịch!");
            if (calendarInstance) calendarInstance.refetchEvents();
            if (String(wsId) === String(currentWorkspaceId)) {
                loadWorkspaceDetails();
            }
        }
    }
}

// Mở Modal xem chi tiết cuộc họp
function openMeetingDetail(event) {
    const rawId = event.id.replace('meeting-', '');
    currentMeetingId = rawId;
    const props = event.extendedProps;
    currentMeetingData = {
        id: rawId,
        title: event.title.replace('📅 [Họp] ', ''),
        description: props.description || '',
        start: event.start,
        end: event.end,
        meeting_link: props.meeting_link || '',
        workspace_id: props.workspace_id || currentWorkspaceId
    };

    document.getElementById("md-title").textContent = currentMeetingData.title;
    document.getElementById("md-desc").textContent = props.description || "Không có nội dung mô tả.";
    document.getElementById("md-creator").textContent = props.creator_name || (props.creator ? props.creator.username : "Thành viên");

    const startStr = new Date(event.start).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const endStr = event.end ? new Date(event.end).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
    document.getElementById("md-time").textContent = endStr ? `${startStr} - ${endStr}` : startStr;

    const joinBtn = document.getElementById("md-join-btn");
    joinBtn.href = props.meeting_link || "#";

    openModal("meeting-detail-modal");
}

// Mở Modal chỉnh sửa cuộc họp từ Modal chi tiết
function openEditMeetingModal() {
    if (!currentMeetingData) return;
    closeModal("meeting-detail-modal");

    calendarModalMode = 'EDIT_MEETING';
    calendarModalType = 'MEETING';

    document.getElementById("cal-modal-title").textContent = "Chỉnh sửa cuộc họp";
    document.getElementById("cal-modal-subtitle").textContent = "Cập nhật thời gian hoặc nội dung cuộc họp";
    document.getElementById("cal-type-switcher").classList.add("hidden");
    document.getElementById("cal-submit-btn").innerHTML = '<i class="fa-solid fa-check mr-1.5"></i> Cập nhật cuộc họp';

    populateCalendarWorkspaceSelect(currentMeetingData.workspace_id);

    document.getElementById("meet-title").value = currentMeetingData.title;
    document.getElementById("meet-desc").value = currentMeetingData.description;
    document.getElementById("meet-link").value = currentMeetingData.meeting_link;

    if (currentMeetingData.start) {
        document.getElementById("meet-start").value = formatDateTimeLocal(new Date(currentMeetingData.start));
    }
    if (currentMeetingData.end) {
        document.getElementById("meet-end").value = formatDateTimeLocal(new Date(currentMeetingData.end));
    }

    switchCalendarModalTab('MEETING');
    openModal("create-meeting-modal");
}

async function handleDeleteMeeting() {
    if (!currentMeetingId) return;
    if (!confirm("Bạn có chắc chắn muốn hủy cuộc họp này?")) return;

    const res = await apiCall(`/meetings/${currentMeetingId}`, "DELETE");
    if (res) {
        closeModal("meeting-detail-modal");
        showToast("Đã hủy cuộc họp thành công!");
        if (calendarInstance) calendarInstance.refetchEvents();
        loadRecentActivitiesWidget();
    }
}

async function loadMyTasks() {
    const tasks = await apiCall("/tasks/me", "GET");
    const container = document.getElementById("my-tasks-list");
    container.innerHTML = "";

    if (!tasks || tasks.length === 0) {
        container.innerHTML = `<p class="p-6 text-sm text-slate-400 text-center">Bạn chưa được phân công công việc nào.</p>`;
        return;
    }

    tasks.forEach(t => {
        const item = document.createElement("div");
        item.className = "p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer";
        item.onclick = () => openTaskDetail(t.id);

        const d = parseUTCDate(t.due_date);
        const dueStr = d ? d.toLocaleDateString('vi-VN') : 'Không hạn';

        const wsOfTask = allWorkspaces.find(w => String(w.id) === String(t.workspace_id));
        const currentUser = getCurrentUser();
        const isWsOwner = wsOfTask && currentUser && (String(wsOfTask.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));

        let statusActionHtml = '';
        if (isWsOwner) {
            statusActionHtml = `
                <select onclick="event.stopPropagation()" onchange="handleQuickTaskStatusChange(${t.id}, this.value, event)" class="text-xs font-bold px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xs focus:outline-none hover:border-blue-400 cursor-pointer">
                    <option value="TODO" ${t.status === 'TODO' ? 'selected' : ''}>To Do</option>
                    <option value="IN_PROGRESS" ${t.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                    <option value="REVIEW" ${t.status === 'REVIEW' ? 'selected' : ''}>Review</option>
                    <option value="DONE" ${t.status === 'DONE' ? 'selected' : ''}>Done</option>
                    <option value="CANCELLED" ${t.status === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
                </select>
            `;
        } else {
            const statusLabels = {
                'TODO': 'bg-slate-100 text-slate-700',
                'IN_PROGRESS': 'bg-blue-100 text-blue-700',
                'REVIEW': 'bg-amber-100 text-amber-700',
                'DONE': 'bg-emerald-100 text-emerald-700',
                'CANCELLED': 'bg-rose-100 text-rose-700'
            };
            const colorClass = statusLabels[t.status] || 'bg-slate-100 text-slate-700';
            statusActionHtml = `<span class="text-xs font-bold px-3 py-1 rounded-xl ${colorClass}" title="Chỉ Owner của Workspace mới có quyền đổi trạng thái">${t.status}</span>`;
        }

        item.innerHTML = `
            <div>
                <h5 class="text-sm font-bold text-slate-900">${t.title}</h5>
                <p class="text-xs text-slate-400 mt-0.5">Hạn chót: ${dueStr}</p>
            </div>
            <div class="flex items-center gap-3">
                ${statusActionHtml}
            </div>
        `;
        container.appendChild(item);
    });
}

async function loadMyTasksCount() {
    const tasks = await apiCall("/tasks/me", "GET");
    const countBadge = document.getElementById("badge-my-tasks-count");
    if (countBadge && tasks) {
        countBadge.textContent = tasks.length;
    }
}

// ==========================================
// QUẢN LÝ THÀNH VIÊN VÀ USER ID
// ==========================================

function copyMyUserId(e) {
    if (e) e.stopPropagation();
    const user = getCurrentUser();
    if (!user || !user.id) {
        showToast("Chưa tải được thông tin User ID!", "warning");
        return;
    }
    const idText = String(user.id);
    navigator.clipboard.writeText(idText).then(() => {
        showToast(`Đã sao chép User ID của bạn: #${idText}`, "info");
    }).catch(() => {
        prompt("User ID của bạn là:", idText);
    });
}

async function loadMembers() {
    if (!currentWorkspaceId) {
        if (allWorkspaces && allWorkspaces.length > 0) {
            currentWorkspaceId = allWorkspaces[0].id;
        } else {
            return;
        }
    }
    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const currentUser = getCurrentUser();
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));

    const addMemberCard = document.getElementById("add-member-card");
    if (addMemberCard) {
        if (isOwner) addMemberCard.classList.remove("hidden");
        else addMemberCard.classList.add("hidden");
    }

    const members = await apiCall(`/workspaces/${currentWorkspaceId}/members`, "GET");
    const container = document.getElementById("members-list");
    if (!container) return;
    container.innerHTML = "";

    if (!members || members.length === 0) {
        container.innerHTML = `<p class="p-6 text-sm text-slate-400 text-center">Chưa có thành viên nào.</p>`;
        return;
    }

    members.forEach(m => {
        const item = document.createElement("div");
        item.className = "px-6 py-4 flex items-center justify-between";
        const d = parseUTCDate(m.joined_at);
        const dateStr = d ? d.toLocaleDateString('vi-VN') : new Date(m.joined_at).toLocaleDateString('vi-VN');
        const uname = (m.user && m.user.username) ? m.user.username : `User #${m.user_id}`;
        const initial = uname.charAt(0).toUpperCase();

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                    ${initial}
                </div>
                <div>
                    <p class="text-sm font-bold text-slate-800">${uname}</p>
                    <p class="text-xs text-slate-400">Tham gia: ${dateStr}</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold px-2.5 py-1 rounded-full ${m.role === 'OWNER' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">${m.role}</span>
                ${(m.role !== 'OWNER' && isOwner) ? `<button onclick="handleRemoveMember('${m.user_id}')" class="text-rose-600 hover:text-rose-800 text-xs font-semibold py-1 px-2 rounded-lg hover:bg-rose-50 transition">Xóa</button>` : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

async function handleAddMember(e) {
    e.preventDefault();
    if (!currentWorkspaceId) {
        if (allWorkspaces && allWorkspaces.length > 0) {
            currentWorkspaceId = allWorkspaces[0].id;
        } else {
            showToast("Vui lòng chọn hoặc tạo dự án trước!", "warning");
            return;
        }
    }
    const inputEl = document.getElementById("new-member-userid");
    const userId = inputEl.value.trim();
    if (!userId) return;

    const res = await apiCall(`/workspaces/${currentWorkspaceId}/members`, "POST", { user_id: userId });
    if (res) {
        showToast("Thêm thành viên thành công!", "success");
        inputEl.value = "";
        loadMembers();
        loadAllData();
    }
}

async function handleRemoveMember(userId) {
    if (!confirm(`Bạn có chắc muốn xóa thành viên #${userId}?`)) return;
    const res = await apiCall(`/workspaces/${currentWorkspaceId}/members/${userId}`, "DELETE");
    if (res !== null) {
        showToast("Đã xóa thành viên khỏi dự án!", "info");
        loadMembers();
        loadAllData();
    }
}

async function loadFullActivities() {
    if (!currentWorkspaceId) return;
    const container = document.getElementById("full-activity-timeline");
    if (!container) return;
    container.innerHTML = "";

    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    const currentUser = getCurrentUser();

    // KIỂM TRA QUYỀN OWNER: Chỉ chủ sở hữu dự án mới thấy
    const isOwner = currentWs && currentUser && (String(currentWs.owner_id) === String(currentUser.id));
    if (!isOwner) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-500 bg-white border border-slate-200/70 rounded-2xl">
                <i class="fa-solid fa-lock text-2xl text-slate-400 mb-2"></i>
                <p class="font-bold text-sm">Chỉ chủ sở hữu (Owner) của dự án mới có quyền xem hoạt động.</p>
            </div>
        `;
        return;
    }

    const activities = await apiCall(`/workspaces/${currentWorkspaceId}/activities`, "GET");
    if (!activities || activities.length === 0) {
        container.innerHTML = `<p class="p-6 text-sm text-slate-400 text-center">Chưa có hoạt động nào.</p>`;
        return;
    }

    activities.forEach(act => {
        const item = document.createElement("div");
        item.className = "flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200/70 shadow-sm";
        const d = parseUTCDate(act.created_at);
        const timeStr = d ? d.toLocaleString('vi-VN') : "vừa xong";

        item.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-xs mt-0.5">
                <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div class="flex-1">
                <p class="text-sm font-semibold text-slate-800">${act.description}</p>
                <div class="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>${timeStr}</span>
                    <span class="font-mono text-[11px] bg-slate-100 px-1.5 py-0.2 rounded font-bold text-slate-600">${act.action_type}</span>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}


// ==========================================
// 10. MODAL UTILITIES
// ==========================================

function openModal(id) {
    if (id === "create-task-modal") {
        const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
        const currentUser = getCurrentUser();
        const isOwner = currentWs && currentUser && (String(currentWs.owner_id).replace('#', '') === String(currentUser.id).replace('#', ''));
        if (!isOwner) {
            showToast("Chỉ Chủ sở hữu (Owner) của Workspace mới có quyền tạo và gán công việc!", "warning");
            return;
        }
    }
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove("hidden");
        if (id === "create-task-modal") {
            populateTaskAssigneeSelect("task-assignee");
        }
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
}

function toggleFilterMenu() {
    alert("Bộ lọc nhanh: Bạn có thể nhập từ khóa vào ô tìm kiếm hoặc click trực tiếp vào trạng thái trên bảng!");
}
