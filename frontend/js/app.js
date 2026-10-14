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
            alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
            handleLogout();
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

function checkAuthState() {
    const token = getToken();
    const user = getCurrentUser();
    const authScreen = document.getElementById("auth-screen");

    if (token && user) {
        authScreen.classList.add("hidden");
        const displayName = user.username || "User";
        document.getElementById("user-display-name").textContent = displayName;
        document.getElementById("banner-username").textContent = displayName.split(" ")[0] || displayName;
        document.getElementById("user-display-email").textContent = user.email || "";
        document.getElementById("user-avatar-initial").textContent = displayName.substring(0, 2).toUpperCase();

        loadAllData();
    } else {
        authScreen.classList.remove("hidden");
    }
}

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
    const views = ["home", "calendar", "mytasks", "team", "activities"];

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
        loadWorkspaceDetails();
    } else if (view === "calendar") {
        initOrRefreshCalendar();
    } else if (view === "mytasks") {
        loadMyTasks();
    } else if (view === "team") {
        loadMembers();
    } else if (view === "activities") {
        loadFullActivities();
    }
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
    container.innerHTML = "";

    const cardStyles = [
        { bg: "bg-purple-50", text: "text-purple-600", tagBg: "bg-purple-100 text-purple-700", tag: "Backend", icon: "fa-solid fa-shapes" },
        { bg: "bg-emerald-50", text: "text-emerald-600", tagBg: "bg-emerald-100 text-emerald-700", tag: "Full Stack", icon: "fa-solid fa-layer-group" },
        { bg: "bg-rose-50", text: "text-rose-600", tagBg: "bg-rose-100 text-rose-700", tag: "Frontend", icon: "fa-solid fa-mobile-screen-button" },
        { bg: "bg-amber-50", text: "text-amber-600", tagBg: "bg-amber-100 text-amber-700", tag: "Frontend", icon: "fa-solid fa-images" },
        { bg: "bg-sky-50", text: "text-sky-600", tagBg: "bg-sky-100 text-sky-700", tag: "Frontend", icon: "fa-solid fa-globe" }
    ];

    workspaces.forEach((ws, idx) => {
        const style = cardStyles[idx % cardStyles.length];
        const isSelected = String(ws.id) === String(currentWorkspaceId);

        const card = document.createElement("div");
        card.className = `bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md space-y-3.5 ${
            isSelected ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200/80'
        }`;
        card.onclick = () => selectWorkspace(ws.id);

        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="w-9 h-9 rounded-xl ${style.bg} ${style.text} flex items-center justify-center text-sm font-bold">
                    <i class="${style.icon}"></i>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${style.tagBg}">${style.tag}</span>
            </div>
            <div>
                <h4 class="font-extrabold text-sm text-slate-900 truncate leading-snug">${ws.name}</h4>
                <div class="flex items-center gap-2 mt-2">
                    <div class="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-blue-600 h-full rounded-full" style="width: 50%"></div>
                    </div>
                    <span class="text-[11px] font-bold text-slate-400">50%</span>
                </div>
            </div>
            <p class="text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100 truncate">
                ID: #${ws.id} • ${ws.description || 'Dự án đang triển khai'}
            </p>
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
}

async function loadWorkspaceDetails() {
    if (!currentWorkspaceId) return;

    const currentWs = allWorkspaces.find(w => String(w.id) === String(currentWorkspaceId));
    if (currentWs) {
        document.getElementById("current-board-project-name").textContent = currentWs.name;
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
        const d = new Date(task.due_date);
        dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Assignee
    const assigneeInitial = (task.assignee && task.assignee.username)
        ? task.assignee.username.substring(0, 1).toUpperCase()
        : "?";

    card.innerHTML = `
        <h5 class="font-bold text-xs text-slate-800 leading-snug line-clamp-2">${task.title}</h5>
        <div class="flex items-center gap-1.5 flex-wrap">
            <span class="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">Backend</span>
            <span class="${priorityClass} text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span class="w-1 h-1 rounded-full ${priorityDot}"></span> ${task.priority}
            </span>
        </div>
        <div class="flex items-center justify-between pt-1 text-[11px] text-slate-400 font-medium">
            <span>${dateStr}</span>
            <div class="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[9px] flex items-center justify-center">
                ${assigneeInitial}
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

async function loadRecentActivitiesWidget() {
    if (!currentWorkspaceId) return;
    const activities = await apiCall(`/workspaces/${currentWorkspaceId}/activities`, "GET");
    const container = document.getElementById("recent-activity-list");
    container.innerHTML = "";

    if (!activities || activities.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 py-2">No recent activity.</p>`;
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
        const d = new Date(t.due_date);
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
    const past = new Date(dateStr);
    const diffMin = Math.round((now - past) / 60000);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
}


// ==========================================
// 7. TASK DETAIL MODAL (COMMENTS & AUDIT LOG)
// ==========================================

async function openTaskDetail(taskId) {
    currentTaskId = taskId;
    const task = await apiCall(`/tasks/${taskId}`, "GET");
    if (!task) return;

    document.getElementById("modal-task-id").textContent = `#${task.id}`;
    document.getElementById("modal-task-title").textContent = task.title;
    document.getElementById("modal-task-desc").textContent = task.description || "No description provided.";
    document.getElementById("modal-task-status").textContent = task.status;
    document.getElementById("modal-task-priority").textContent = task.priority;

    if (task.due_date) {
        document.getElementById("modal-task-due").textContent = new Date(task.due_date).toLocaleString('vi-VN');
    } else {
        document.getElementById("modal-task-due").textContent = "Chưa đặt";
    }

    document.getElementById("modal-task-assignee").textContent = (task.assignee && task.assignee.username)
        ? task.assignee.username
        : "Chưa gán";

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
        const dateStr = new Date(c.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
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
        const timeStr = new Date(a.created_at).toLocaleString('vi-VN');

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

    const title = document.getElementById("task-title").value.trim();
    const description = document.getElementById("task-desc").value.trim();
    const priority = document.getElementById("task-priority").value;
    const dueVal = document.getElementById("task-due-date").value;

    const payload = {
        title,
        description: description || null,
        priority,
        status: "TODO",
        due_date: dueVal ? new Date(dueVal).toISOString() : null
    };

    const res = await apiCall(`/workspaces/${currentWorkspaceId}/tasks`, "POST", payload);
    if (res) {
        closeModal("create-task-modal");
        document.getElementById("task-title").value = "";
        document.getElementById("task-desc").value = "";
        document.getElementById("task-due-date").value = "";
        loadWorkspaceDetails();
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
        loadWorkspaces();
    }
}

async function handleJoinWorkspace(e) {
    e.preventDefault();
    const wsId = document.getElementById("join-ws-id").value.trim();
    if (!wsId) return;

    const res = await apiCall(`/workspaces/${wsId}/join`, "POST");
    if (res) {
        alert("Tham gia Workspace thành công!");
        closeModal("join-workspace-modal");
        document.getElementById("join-ws-id").value = "";
        currentWorkspaceId = wsId;
        loadWorkspaces();
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
                const url = `/workspaces/${currentWorkspaceId}/calendar-events?from_date=${info.startStr}&to_date=${info.endStr}`;
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
                            else if (e.task_priority === 'LOW') { bg = '#16a34a'; border = '#15803d'; }
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

            // Render giao diện thẻ sự kiện đẹp mắt với icon
            eventContent: function(arg) {
                const props = arg.event.extendedProps;
                const isMeeting = (props.event_type === 'MEETING');
                const iconClass = isMeeting ? 'fa-solid fa-video' : 'fa-solid fa-thumbtack';
                const cleanTitle = isMeeting 
                    ? arg.event.title.replace('📅 [Họp] ', '') 
                    : arg.event.title.replace('📌 [Hạn chót] ', '');
                const timeText = arg.timeText ? `<span class="opacity-80 text-[10px] mr-1">${arg.timeText}</span>` : '';

                const el = document.createElement('div');
                el.className = 'flex items-center gap-1.5 px-1.5 py-0.5 truncate w-full text-white text-xs leading-tight';
                el.innerHTML = `
                    <i class="${iconClass} text-[10px] shrink-0"></i>
                    ${timeText}
                    <span class="font-bold truncate">${cleanTitle}</span>
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
    } else {
        calendarInstance.refetchEvents();
    }
}

// Xử lý kéo thả sự kiện sang giờ/ngày mới
async function handleEventDrop(info) {
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
            opt.textContent = `Thành viên #${m.user_id} (${m.role})`;
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
        const assigneeId = document.getElementById("cal-task-assignee").value || null;
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
    document.getElementById("md-creator").textContent = props.creator ? props.creator.username : "Thành viên";

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

        item.innerHTML = `
            <div>
                <h5 class="text-sm font-bold text-slate-900">${t.title}</h5>
                <p class="text-xs text-slate-400 mt-0.5">Hạn chót: ${t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : 'Không hạn'}</p>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">${t.status}</span>
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

async function loadMembers() {
    if (!currentWorkspaceId) return;
    const members = await apiCall(`/workspaces/${currentWorkspaceId}/members`, "GET");
    const container = document.getElementById("members-list");
    container.innerHTML = "";

    if (!members || members.length === 0) {
        container.innerHTML = `<p class="p-6 text-sm text-slate-400 text-center">Chưa có thành viên nào.</p>`;
        return;
    }

    members.forEach(m => {
        const item = document.createElement("div");
        item.className = "px-6 py-4 flex items-center justify-between";
        const dateStr = new Date(m.joined_at).toLocaleDateString('vi-VN');

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                    #${m.user_id}
                </div>
                <div>
                    <p class="text-sm font-bold text-slate-800">User ID: ${m.user_id}</p>
                    <p class="text-xs text-slate-400">Tham gia: ${dateStr}</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">${m.role}</span>
                <button onclick="handleRemoveMember('${m.user_id}')" class="text-rose-600 hover:text-rose-800 text-xs font-semibold py-1 px-2 rounded-lg hover:bg-rose-50 transition">Xóa</button>
            </div>
        `;
        container.appendChild(item);
    });
}

async function handleAddMember(e) {
    e.preventDefault();
    if (!currentWorkspaceId) return;
    const userId = document.getElementById("new-member-userid").value.trim();

    const res = await apiCall(`/workspaces/${currentWorkspaceId}/members`, "POST", { user_id: userId });
    if (res) {
        document.getElementById("new-member-userid").value = "";
        loadMembers();
    }
}

async function handleRemoveMember(userId) {
    if (!confirm(`Bạn có chắc muốn xóa thành viên #${userId}?`)) return;
    const res = await apiCall(`/workspaces/${currentWorkspaceId}/members/${userId}`, "DELETE");
    if (res) {
        loadMembers();
    }
}

async function loadFullActivities() {
    if (!currentWorkspaceId) return;
    const activities = await apiCall(`/workspaces/${currentWorkspaceId}/activities`, "GET");
    const container = document.getElementById("full-activity-timeline");
    container.innerHTML = "";

    if (!activities || activities.length === 0) {
        container.innerHTML = `<p class="p-6 text-sm text-slate-400 text-center">Chưa có hoạt động nào.</p>`;
        return;
    }

    activities.forEach(act => {
        const item = document.createElement("div");
        item.className = "flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200/70 shadow-sm";
        const timeStr = new Date(act.created_at).toLocaleString('vi-VN');

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
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
}

function toggleFilterMenu() {
    alert("Bộ lọc nhanh: Bạn có thể nhập từ khóa vào ô tìm kiếm hoặc click trực tiếp vào trạng thái trên bảng!");
}
