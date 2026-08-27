import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import {
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRoundPlus,
  UsersRound,
  createElement
} from "lucide";

const ICONS = {
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRoundPlus,
  UsersRound
};

const app = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");
const state = {
  user: null,
  view: "door",
  authMode: "login",
  passkeys: [],
  users: []
};

function icon(name, className = "") {
  const Icon = ICONS[name];
  if (!Icon) return "";
  return createElement(Icon, {
    class: `icon ${className}`,
    "aria-hidden": "true"
  }).outerHTML;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(timestamp) {
  if (!timestamp) return "尚未登录";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp * 1000));
}

function showToast(message, tone = "default") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  toastRegion.append(toast);
  setTimeout(() => toast.remove(), 4200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "x-requested-with": "door-access",
      ...(options.body && { "content-type": "application/json" }),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({ message: "服务器返回了无法识别的内容" }));

  if (!response.ok) {
    const error = new Error(data.message || "请求失败");
    error.status = response.status;
    throw error;
  }

  return data;
}

function setButtonLoading(button, loading, label = "处理中") {
  if (!button) return;
  if (loading) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `${icon("LoaderCircle", "spin")}<span>${label}</span>`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.original ?? button.innerHTML;
  }
}

function renderAuth() {
  const login = state.authMode === "login";
  app.innerHTML = `
    <main class="auth-layout">
      <section class="auth-pane">
        <div class="auth-inner">
          <div class="brand-lockup">
            <span class="brand-mark">${icon("LockKeyhole")}</span>
            <span>智能门禁</span>
          </div>

          <div class="auth-heading">
            <h1>${login ? "欢迎回来" : "申请门禁账号"}</h1>
            <p>${login ? "登录后即可安全控制门禁。" : "提交注册后，由管理员审核开通。"}</p>
          </div>

          <div class="auth-tabs" role="tablist" aria-label="账号入口">
            <button class="auth-tab ${login ? "is-active" : ""}" data-auth-mode="login" type="button" role="tab" aria-selected="${login}">登录</button>
            <button class="auth-tab ${!login ? "is-active" : ""}" data-auth-mode="register" type="button" role="tab" aria-selected="${!login}">注册</button>
          </div>

          <form class="auth-form" id="${login ? "login-form" : "register-form"}">
            <label class="field">
              <span>用户名</span>
              <input name="username" autocomplete="username webauthn" minlength="3" maxlength="32" required placeholder="输入用户名" />
            </label>
            <label class="field">
              <span>密码</span>
              <input name="password" type="password" autocomplete="${login ? "current-password" : "new-password"}" minlength="10" maxlength="128" required placeholder="至少 10 个字符" />
            </label>
            ${
              login
                ? ""
                : `<label class="field">
                    <span>确认密码</span>
                    <input name="passwordConfirm" type="password" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="再次输入密码" />
                  </label>`
            }
            <button class="button button-primary button-full" type="submit">
              ${icon(login ? "LogIn" : "UserRoundPlus")}
              <span>${login ? "登录" : "提交申请"}</span>
            </button>
          </form>

          ${
            login
              ? `<div class="divider"><span>或</span></div>
                 <button class="button button-passkey button-full" id="passkey-login" type="button">
                   ${icon("Fingerprint")}
                   <span>使用 Apple 通行密钥</span>
                 </button>`
              : ""
          }
        </div>
      </section>
      <section class="auth-visual" aria-label="智能门锁">
        <img src="/assets/smart-entry.jpg" alt="手机控制的智能门锁" />
        <div class="visual-caption">
          <span class="visual-icon">${icon("ShieldCheck")}</span>
          <div><strong>安全通行</strong><span>账号审核、设备验证、操作留痕</span></div>
        </div>
      </section>
    </main>`;
}

function navButton(view, iconName, label, extra = "") {
  return `<button class="nav-item ${state.view === view ? "is-active" : ""}" data-view="${view}" type="button">
    ${icon(iconName)}<span>${label}</span>${extra}
  </button>`;
}

function renderShell() {
  const adminNav = state.user.role === "admin" ? navButton("users", "UsersRound", "用户管理") : "";
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-lockup sidebar-brand">
          <span class="brand-mark">${icon("LockKeyhole")}</span>
          <span>智能门禁</span>
        </div>
        <nav class="primary-nav" aria-label="主导航">
          ${navButton("door", "KeyRound", "门禁")}
          ${navButton("passkeys", "Fingerprint", "通行密钥")}
          ${adminNav}
        </nav>
        <button class="account-control" id="logout" type="button">
          <span class="avatar">${escapeHtml(state.user.username.slice(0, 1).toUpperCase())}</span>
          <span class="account-copy"><strong>${escapeHtml(state.user.username)}</strong><small>${state.user.role === "admin" ? "管理员" : "成员"}</small></span>
          ${icon("LogOut")}
        </button>
      </aside>

      <main class="workspace">
        <header class="mobile-header">
          <div class="brand-lockup"><span class="brand-mark">${icon("LockKeyhole")}</span><span>智能门禁</span></div>
          <button class="icon-button" id="mobile-logout" type="button" title="退出登录">${icon("LogOut")}</button>
        </header>
        <div class="view-container" id="view-container"></div>
      </main>

      <nav class="mobile-nav" aria-label="主导航">
        ${navButton("door", "KeyRound", "门禁")}
        ${navButton("passkeys", "Fingerprint", "密钥")}
        ${adminNav}
      </nav>
    </div>`;
  renderCurrentView();
}

function renderDoor() {
  document.querySelector("#view-container").innerHTML = `
    <section class="view door-view">
      <div class="view-header centered-header">
        <span class="eyebrow">主入口</span>
        <h1>门禁控制</h1>
        <p id="door-status-copy">设备已就绪</p>
      </div>
      <div class="door-control state-idle" id="door-control">
        <div class="door-ring"></div>
        <button class="door-button" id="open-door" type="button" aria-label="点击开门">
          <span class="door-button-icon" id="door-button-icon">${icon("KeyRound")}</span>
          <span id="door-button-label">开门</span>
        </button>
      </div>
      <div class="security-note">${icon("ShieldCheck")}<span>操作将记录到安全日志</span></div>
    </section>`;
}

function renderPasskeys() {
  document.querySelector("#view-container").innerHTML = `
    <section class="view">
      <div class="view-header split-header">
        <div><span class="eyebrow">账号安全</span><h1>通行密钥</h1><p>通过面容 ID、触控 ID 或设备密码登录。</p></div>
        <button class="button button-primary" id="add-passkey" type="button">${icon("Fingerprint")}<span>添加通行密钥</span></button>
      </div>
      <div class="content-panel">
        <div class="section-title"><h2>已绑定设备</h2><span>${state.passkeys.length} 个</span></div>
        <div class="item-list">
          ${
            state.passkeys.length
              ? state.passkeys
                  .map(
                    (passkey) => `<article class="list-item">
                      <span class="item-icon">${icon("Fingerprint")}</span>
                      <div class="item-copy"><strong>${escapeHtml(passkey.name)}</strong><span>${passkey.backedUp ? "已同步到 iCloud 钥匙串" : "仅保存在当前设备"} · 添加于 ${formatDate(passkey.createdAt)}</span></div>
                      <button class="icon-button danger" type="button" data-delete-passkey="${encodeURIComponent(passkey.id)}" title="删除通行密钥">${icon("Trash2")}</button>
                    </article>`
                  )
                  .join("")
              : `<div class="empty-state">${icon("Fingerprint")}<strong>尚未添加通行密钥</strong><span>添加后可以使用 Apple 设备快速登录。</span></div>`
          }
        </div>
      </div>
    </section>`;
}

function statusLabel(status) {
  return { pending: "待审核", active: "已启用", disabled: "已停用" }[status] ?? status;
}

function renderUsers() {
  const pendingCount = state.users.filter((user) => user.status === "pending").length;
  document.querySelector("#view-container").innerHTML = `
    <section class="view">
      <div class="view-header split-header">
        <div><span class="eyebrow">访问控制</span><h1>用户管理</h1><p>审核账号并管理门禁访问权限。</p></div>
        <div class="metric"><strong>${state.users.length}</strong><span>用户</span></div>
      </div>
      ${pendingCount ? `<div class="pending-banner">${icon("Clock3")}<span><strong>${pendingCount} 个账号</strong>等待审核</span></div>` : ""}
      <div class="content-panel user-panel">
        <div class="section-title"><h2>全部用户</h2><span>${state.users.length} 个</span></div>
        <div class="user-list">
          ${state.users
            .map(
              (user) => `<article class="user-row" data-user-id="${user.id}">
                <span class="avatar user-avatar">${escapeHtml(user.username.slice(0, 1).toUpperCase())}</span>
                <div class="user-copy"><strong>${escapeHtml(user.username)}${user.id === state.user.id ? " <small>你</small>" : ""}</strong><span>上次登录：${formatDate(user.lastLoginAt)} · ${user.passkeyCount} 个通行密钥</span></div>
                <span class="status status-${user.status}">${statusLabel(user.status)}</span>
                <select class="select role-select" aria-label="${escapeHtml(user.username)} 的角色" ${user.id === state.user.id ? "disabled" : ""}>
                  <option value="user" ${user.role === "user" ? "selected" : ""}>成员</option>
                  <option value="admin" ${user.role === "admin" ? "selected" : ""}>管理员</option>
                </select>
                <div class="row-actions">
                  ${
                    user.status === "pending"
                      ? `<button class="button button-small button-primary" data-user-status="active" type="button">${icon("UserCheck")}<span>批准</span></button>`
                      : user.status === "active" && user.id !== state.user.id
                        ? `<button class="button button-small button-secondary" data-user-status="disabled" type="button"><span>停用</span></button>`
                        : user.status === "disabled"
                          ? `<button class="button button-small button-secondary" data-user-status="active" type="button"><span>启用</span></button>`
                          : ""
                  }
                </div>
              </article>`
            )
            .join("")}
        </div>
      </div>
    </section>`;
}

async function renderCurrentView() {
  if (state.view === "passkeys") {
    renderPasskeys();
    await loadPasskeys();
  } else if (state.view === "users" && state.user.role === "admin") {
    renderUsers();
    await loadUsers();
  } else {
    state.view = "door";
    renderDoor();
  }
}

async function loadPasskeys() {
  try {
    state.passkeys = (await api("/api/passkeys")).passkeys;
    if (state.view === "passkeys") renderPasskeys();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadUsers() {
  try {
    state.users = (await api("/api/admin/users")).users;
    if (state.view === "users") renderUsers();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function handleAuthSubmit(form) {
  const submit = form.querySelector("button[type=submit]");
  const values = Object.fromEntries(new FormData(form));
  setButtonLoading(submit, true, state.authMode === "login" ? "登录中" : "提交中");

  try {
    if (state.authMode === "register") {
      if (values.password !== values.passwordConfirm) throw new Error("两次输入的密码不一致");
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: values.username, password: values.password })
      });
      state.authMode = "login";
      renderAuth();
      showToast(data.message, "success");
    } else {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: values.username, password: values.password })
      });
      state.user = data.user;
      renderShell();
    }
  } catch (error) {
    showToast(error.message, "error");
    setButtonLoading(submit, false);
  }
}

async function loginWithPasskey(button) {
  if (!window.PublicKeyCredential) {
    showToast("当前浏览器不支持通行密钥", "error");
    return;
  }

  setButtonLoading(button, true, "正在验证");
  try {
    const username = document.querySelector('input[name="username"]')?.value.trim() ?? "";
    const data = await api("/api/passkeys/login/options", {
      method: "POST",
      body: JSON.stringify({ username })
    });
    const response = await startAuthentication({ optionsJSON: data.options });
    const result = await api("/api/passkeys/login/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId: data.challengeId, response })
    });
    state.user = result.user;
    renderShell();
  } catch (error) {
    if (error.name !== "NotAllowedError") showToast(error.message, "error");
    setButtonLoading(button, false);
  }
}

async function addPasskey(button) {
  if (!window.PublicKeyCredential) {
    showToast("当前浏览器不支持通行密钥", "error");
    return;
  }

  setButtonLoading(button, true, "正在添加");
  try {
    const data = await api("/api/passkeys/register/options", {
      method: "POST",
      body: "{}"
    });
    const response = await startRegistration({ optionsJSON: data.options });
    const result = await api("/api/passkeys/register/verify", {
      method: "POST",
      body: JSON.stringify({
        challengeId: data.challengeId,
        response,
        name: /iPhone|iPad|Macintosh/.test(navigator.userAgent) ? "iCloud 钥匙串" : "通行密钥"
      })
    });
    showToast(result.message, "success");
    await loadPasskeys();
  } catch (error) {
    if (error.name !== "NotAllowedError") showToast(error.message, "error");
    setButtonLoading(button, false);
  }
}

async function openDoor() {
  const control = document.querySelector("#door-control");
  const button = document.querySelector("#open-door");
  const label = document.querySelector("#door-button-label");
  const buttonIcon = document.querySelector("#door-button-icon");
  const status = document.querySelector("#door-status-copy");

  if (!control || control.classList.contains("state-loading")) return;
  control.className = "door-control state-loading";
  button.disabled = true;
  label.textContent = "开启中";
  buttonIcon.innerHTML = icon("LoaderCircle", "spin");
  status.textContent = "正在连接门锁";

  try {
    const data = await api("/api/open-door", {
      method: "POST",
      headers: { "x-door-action": "open" },
      body: "{}"
    });
    control.className = "door-control state-success";
    label.textContent = "已开启";
    buttonIcon.innerHTML = icon("Check");
    status.textContent = "门锁已开启";
    showToast(data.message || "门锁已开启", "success");
  } catch (error) {
    control.className = "door-control state-error";
    label.textContent = "失败重试";
    buttonIcon.innerHTML = icon("KeyRound");
    status.textContent = error.message;
    showToast(error.message, "error");
  }

  setTimeout(() => {
    control.className = "door-control state-idle";
    button.disabled = false;
    label.textContent = "开门";
    buttonIcon.innerHTML = icon("KeyRound");
    status.textContent = "设备已就绪";
  }, 3500);
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
  } finally {
    state.user = null;
    state.view = "door";
    renderAuth();
  }
}

app.addEventListener("click", async (event) => {
  const authMode = event.target.closest("[data-auth-mode]");
  if (authMode) {
    state.authMode = authMode.dataset.authMode;
    renderAuth();
    return;
  }

  const nav = event.target.closest("[data-view]");
  if (nav) {
    state.view = nav.dataset.view;
    renderShell();
    return;
  }

  if (event.target.closest("#passkey-login")) await loginWithPasskey(event.target.closest("button"));
  if (event.target.closest("#add-passkey")) await addPasskey(event.target.closest("button"));
  if (event.target.closest("#open-door")) await openDoor();
  if (event.target.closest("#logout, #mobile-logout")) await logout();

  const deletePasskey = event.target.closest("[data-delete-passkey]");
  if (deletePasskey && window.confirm("确定删除这个通行密钥吗？")) {
    try {
      await api(`/api/passkeys/${deletePasskey.dataset.deletePasskey}`, { method: "DELETE", body: "{}" });
      showToast("通行密钥已删除", "success");
      await loadPasskeys();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  const userStatus = event.target.closest("[data-user-status]");
  if (userStatus) {
    const row = userStatus.closest("[data-user-id]");
    const role = row.querySelector(".role-select").value;
    setButtonLoading(userStatus, true, "保存中");
    try {
      await api(`/api/admin/users/${row.dataset.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: userStatus.dataset.userStatus, role })
      });
      showToast(userStatus.dataset.userStatus === "active" ? "用户已启用" : "用户已停用", "success");
      await loadUsers();
    } catch (error) {
      showToast(error.message, "error");
      setButtonLoading(userStatus, false);
    }
  }
});

app.addEventListener("change", async (event) => {
  if (!event.target.matches(".role-select")) return;
  const row = event.target.closest("[data-user-id]");
  const user = state.users.find((item) => item.id === row.dataset.userId);

  try {
    await api(`/api/admin/users/${row.dataset.userId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: user.status, role: event.target.value })
    });
    showToast("用户角色已更新", "success");
    await loadUsers();
  } catch (error) {
    showToast(error.message, "error");
    event.target.value = user.role;
  }
});

app.addEventListener("submit", async (event) => {
  if (!event.target.matches("#login-form, #register-form")) return;
  event.preventDefault();
  await handleAuthSubmit(event.target);
});

async function initialize() {
  app.innerHTML = `<div class="app-loading">${icon("LoaderCircle", "spin")}<span>正在载入</span></div>`;
  try {
    state.user = (await api("/api/auth/me")).user;
    renderShell();
  } catch {
    renderAuth();
  }
}

initialize();
