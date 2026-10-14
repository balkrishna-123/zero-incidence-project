import { api } from "./api.js";
import { icon, brand } from "./icons.js";
import {
  esc,
  avatar,
  fullName,
  notify,
  modal,
  closeModal,
  bindPasswordToggles,
  bindChecklist,
  timeAgo,
} from "./ui.js";
import { loginPage, firstPasswordPage } from "./login.js";
import { adminPage } from "./admin.js";
import { employeePage, employeeReportHelp } from "./employee.js";
import { trainerPage } from "./trainer.js";
import {
  getWorkspaceTheme,
  applyWorkspaceTheme,
  applyLoginTheme,
  toggleWorkspaceTheme,
  acceptThemeStorageEvent,
} from "./theme.js";

const root = document.getElementById("app");
const state = {
  user: null,
  demoMode: false,
  demoCredentials: null,
  loginUsername: "",
  appVersion: null,
};
let revision = 0;
let disposePage = null;
let signingOut = false;
const home = () => {
  const role = state.user?.role;
  if (role === "admin") return "/admin/overview";
  if (role === "trainer") return "/trainer/overview";
  return "/employee/hub";
};
function navigate(path) {
  closeModal();
  if (location.hash === `#${path}`) render();
  else location.hash = path;
}
async function refreshSession() {
  Object.assign(state, await api.get("/session"));
  return state;
}
async function logout(message = "You have been signed out.") {
  if (signingOut) return;
  signingOut = true;
  const buttons = [...root.querySelectorAll("[data-logout]")];
  const originals = buttons.map((button) => button.innerHTML);
  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = `<span class="spinner"></span>${button.hasAttribute("data-topbar-logout") ? "<span>Signing out…</span>" : ""}`;
  });
  try {
    // This destroys the MongoDB-backed session; it is not just a client redirect.
    try {
      await api.post("/auth/logout");
    } catch (error) {
      // Another tab may have rotated the token, or the old session may have
      // expired. Fetch a fresh CSRF token and retry once, without weakening it.
      if (error.code !== "CSRF_INVALID") throw error;
      await refreshSession();
      await api.post("/auth/logout");
    }
    state.loginUsername = state.user?.username || state.loginUsername;
    state.user = null;
    let readyToSignIn = true;
    try {
      await refreshSession();
    } catch {
      readyToSignIn = false;
    }
    navigate("/login");
    notify(
      readyToSignIn
        ? message
        : "Signed out. Refresh the page before signing in again.",
      readyToSignIn ? "success" : "error",
    );
  } catch (e) {
    notify(e.message, "error");
  } finally {
    signingOut = false;
    buttons.forEach((button, i) => {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.innerHTML = originals[i];
    });
  }
}
function themeButtonContent(theme) {
  const dark = theme === "dark";
  return `<span class="theme-toggle-symbol">${icon(dark ? "sun" : "moon", 16)}</span><span class="theme-toggle-label">${dark ? "Light mode" : "Dark mode"}</span>`;
}
function updateThemeControls() {
  const theme = getWorkspaceTheme(state.user?.role);
  root.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const next = theme === "dark" ? "light" : "dark";
    button.innerHTML = themeButtonContent(theme);
    button.setAttribute("aria-label", `Switch to ${next} theme`);
    button.setAttribute(
      "title",
      `Switch to ${next} theme · remembered in this browser`,
    );
    button.dataset.currentTheme = theme;
  });
}

function help() {
  const role = state.user?.role;
  const admin = role === "admin";
  const trainer = role === "trainer";
  const openHelp = (report) =>
    modal({
      title: "A safer start, step by step",
      subtitle: "Your Zero Incident quick guide",
      content: `
    <p>${admin ? "Everything you need to get a new employee ready for safety training." : trainer ? "Your administrator provides your trainer sign-in and permissions." : "Your administrator provides your account. You set your own password and follow your training journey."}</p>
    <div class="help-steps">
      <div class="help-step"><span>1</span><div><strong>${admin ? "Register an employee" : trainer ? "Check your permissions" : "Make your account yours"}</strong><p>${admin ? "Create a username and temporary password. Share the credentials through a secure channel; they are shown only once." : trainer ? "Your overview shows what your administrator has enabled — viewing employee progress and resetting passwords. Trainers never delete employee IDs." : "Use your temporary credentials, set a new password, then sign in again. Never share your password."}</p></div></div>
      <div class="help-step"><span>2</span><div><strong>${admin ? "Meet your trainers" : trainer ? "Follow your learners" : "Explore your three modules"}</strong><p>${admin ? "Create a trainer profile, sign-in and permissions, upload an image and assign modules. Trainers introduce activities; the assessment system calculates every score." : trainer ? "Open Employee progress to see module scores and completion percentages, or issue a temporary password when an employee is locked out." : "Each module is a journey: your virtual trainer introduces it, then three levels of study material in a rotatable 360° view (full-screen available), each followed by an eight-question quiz (20 seconds per question) with guide hints. The final result — the average of all twenty-four questions — unlocks after the last quiz."}</p></div></div>
      <div class="help-step"><span>3</span><div><strong>${admin ? "Keep track of progress" : "Work toward completion"}</strong><p>Every module must score at least 70 out of 100. An overall average cannot compensate for a failed module. A certificate requires genuine verified passes in all three modules. Sample scores do not count.</p></div></div>
    </div>${report ? report.html : ""}<div class="info-callout mt-24">${icon("info", 17)}<span>The learning flow now includes accounts, all three modules, verified completion and PDF certificates. Demo progress is illustrative, not evidence of completed assessments.</span></div>`,
      footer: '<button class="btn btn-primary" data-close-modal>Got it</button>',
      onMount: (element) => report?.mount(element),
    });
  if (role === "employee") {
    // Report-a-trainer moved here when the star-rating page was retired.
    employeeReportHelp({ api, render() {} })
      .then(openHelp)
      .catch(() => openHelp(null));
    return;
  }
  openHelp(null);
}
async function activity() {
  try {
    const data = await api.get("/admin/overview");
    modal({
      title: "Recent activity",
      subtitle: "Account and trainer changes in your workspace",
      content: `<div class="activity-list">${data.events.length ? data.events.map((event) => `<div class="activity-item"><span class="activity-dot">${icon("clock", 14)}</span><div><p><strong>${esc(event.actorName)}</strong> ${esc(event.action)}</p><small>${esc(event.subject)}</small></div><time>${timeAgo(event.createdAt)}</time></div>`).join("") : '<p class="muted small">No activity yet.</p>'}</div>`,
      footer:
        '<button class="btn btn-secondary" data-close-modal>Close</button>',
    });
  } catch (e) {
    notify(e.message, "error");
  }
}
function shell(page, route) {
  const admin = state.user.role === "admin";
  const trainer = state.user.role === "trainer";
  const navigation = admin
    ? [
        ["overview", "Overview", "grid"],
        ["employees", "Manage employees", "users"],
        ["trainers", "Virtual trainers", "trainer"],
        ["progress", "Learning progress", "chart"],
        ["certificates", "Certificates", "award"],
        ["applications", "Applications", "send"],
        ["reports", "Reports", "alert"],
      ]
    : trainer
      ? [
          ["overview", "Overview", "grid"],
          ["employees", "Employee progress", "users"],
          ["promotion", "Promotion", "trophy"],
        ]
      : [
          ["hub", "Training hub", "grid"],
          ["progress", "My progress", "chart"],
          ["certificates", "Certificates", "award"],
        ];
  const prefix = admin ? "/admin" : trainer ? "/trainer" : "/employee";
  const current = route.startsWith("/employee/module/")
    ? "hub"
    : route.split("/")[2];
  const theme = getWorkspaceTheme(state.user.role);
  const nextTheme = theme === "dark" ? "light" : "dark";
  return `<div class="${admin ? "admin-shell" : "employee-shell"}">
    <div class="mobile-scrim" data-sidebar-close></div>
    <aside class="sidebar" id="workspace-navigation" aria-label="Main navigation">
      ${brand(admin, true, trainer ? "TRAINER WORKSPACE" : null)}
      <div class="sidebar-scroll">
        <div class="nav-caption">${admin ? "WORKSPACE" : trainer ? "TRAINER WORKSPACE" : "YOUR LEARNING"}</div>
        <nav class="nav-list">${navigation.map(([key, label, symbol]) => `<a href="#${prefix}/${key}" class="nav-item ${current === key ? "active" : ""}" ${current === key ? 'aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`).join("")}</nav>
        <div class="sidebar-bottom">
          <div class="nav-caption">${admin ? "SYSTEM" : "ACCOUNT"}</div>
          <nav class="nav-list">${!trainer ? `<a href="#${prefix}/settings" class="nav-item ${current === "settings" ? "active" : ""}" ${current === "settings" ? 'aria-current="page"' : ""}>${icon("settings")}<span>${admin ? "Settings" : "My profile & security"}</span></a>` : ""}<button type="button" class="nav-item" data-help style="border:0;text-align:left;background:transparent">${icon("help")}<span>Help & resources</span></button></nav>
          <div class="sidebar-callout">${icon("shield", 18)}<strong>Small actions. Safer workplaces.</strong><p>Every safe decision makes a difference.<br>Build a zero-incident mindset.</p></div>
        </div>
      </div>
      <div class="sidebar-profile">${avatar(state.user, admin ? "avatar-admin" : "")}<div class="sidebar-profile-details"><div class="profile-name">${esc(fullName(state.user))}</div><div class="profile-role">${admin ? "Safety Administrator" : trainer ? "Trainer" : "Employee"}</div></div><button type="button" class="icon-button" data-logout title="Sign out" aria-label="Sign out">${icon("logout", 17)}</button></div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <button type="button" class="icon-button mobile-toggle" data-sidebar-open aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded="false">${icon("menu")}</button>
        <div class="breadcrumbs"><span>${admin ? "Workspace" : "My learning"}</span>${icon("chevron")}<strong title="${esc(page.breadcrumb || page.title)}">${esc(page.breadcrumb || page.title)}</strong></div>
        <div class="topbar-right">
          <span class="environment-badge"><i></i>${state.demoMode ? "Demo workspace" : "Secure workspace"}</span>
          <span class="topbar-divider"></span>
          <button type="button" class="icon-button topbar-activity ${admin ? "bell" : ""}" ${admin ? "data-activity" : "data-help"} title="${admin ? "Recent activity" : "Help & resources"}" aria-label="${admin ? "Recent activity" : "Help & resources"}">${icon(admin ? "bell" : "help", 17)}</button>
          <a class="topbar-account" href="#${prefix}/settings" aria-label="Account settings">${avatar(state.user, "avatar-admin")}</a>
          <button type="button" class="theme-toggle" data-theme-toggle data-current-theme="${theme}" aria-label="Switch to ${nextTheme} theme" title="Switch to ${nextTheme} theme · remembered in this browser">${themeButtonContent(theme)}</button>
          <button type="button" class="btn btn-secondary topbar-signout" data-logout data-topbar-logout aria-label="Sign out" title="Sign out of Zero Incident">${icon("logout", 15)}<span>Sign out</span></button>
        </div>
      </header>
      <main class="workspace-content" id="main-content">${page.html}<footer class="page-footer"><span>${icon("shield")}Zero incidents. Zero excuses.</span><span>Zero Incident &nbsp;·&nbsp; ${state.demoMode ? "Development demo" : "Safety workspace"} &nbsp;·&nbsp; v${state.appVersion || "—"}</span></footer></main>
    </div>
  </div>`;
}
const ctx = {
  state,
  api,
  navigate,
  refreshSession,
  logout,
  help,
  render: () => render(),
};
function syncSidebarAccess() {
  const sidebar = root.querySelector(".sidebar");
  if (!sidebar) return;
  const hidden =
    window.matchMedia("(max-width: 760px)").matches &&
    !sidebar.classList.contains("is-open");
  sidebar.inert = hidden;
  if (hidden) sidebar.setAttribute("aria-hidden", "true");
  else sidebar.removeAttribute("aria-hidden");
}
function bindShell() {
  root.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleWorkspaceTheme(state.user.role);
      updateThemeControls();
    });
  });
  root
    .querySelectorAll("[data-logout]")
    .forEach((b) => b.addEventListener("click", () => logout()));
  root
    .querySelectorAll("[data-help]")
    .forEach((b) => b.addEventListener("click", help));
  root
    .querySelectorAll("[data-activity]")
    .forEach((b) => b.addEventListener("click", activity));
  const open = () => {
    root.querySelector(".sidebar")?.classList.add("is-open");
    root.querySelector(".mobile-scrim")?.classList.add("visible");
    root
      .querySelector("[data-sidebar-open]")
      ?.setAttribute("aria-expanded", "true");
    syncSidebarAccess();
  };
  const close = () => {
    root.querySelector(".sidebar")?.classList.remove("is-open");
    root.querySelector(".mobile-scrim")?.classList.remove("visible");
    root
      .querySelector("[data-sidebar-open]")
      ?.setAttribute("aria-expanded", "false");
    syncSidebarAccess();
  };
  root.querySelector("[data-sidebar-open]")?.addEventListener("click", open);
  root.querySelector("[data-sidebar-close]")?.addEventListener("click", close);
  root
    .querySelectorAll(".nav-item")
    .forEach((link) => link.addEventListener("click", close));
  syncSidebarAccess();
}
async function render() {
  const currentRevision = ++revision;
  let route = location.hash.slice(1) || "/";
  if (!state.user) route = "/login";
  else if (state.user.mustChangePassword) route = "/first-password";
  else if (
    route === "/" ||
    route === "/login" ||
    route === "/first-password" ||
    !route.startsWith(`/${state.user.role}/`)
  )
    route = home();
  if (location.hash !== `#${route}`)
    history.replaceState(null, "", `#${route}`);
  if (route === "/login" || route === "/first-password") applyLoginTheme();
  else applyWorkspaceTheme(state.user.role);
  root.setAttribute("aria-busy", "true");
  try {
    let page;
    if (route === "/login") page = loginPage(ctx);
    else if (route === "/first-password") page = firstPasswordPage(ctx);
    else if (state.user.role === "admin") page = await adminPage(route, ctx);
    else if (state.user.role === "trainer")
      page = await trainerPage(route, ctx);
    else page = await employeePage(route, ctx);
    if (currentRevision !== revision) return;
    disposePage?.();
    disposePage = null;
    root.innerHTML = page.standalone ? page.html : shell(page, route);
    document.title = `${page.title} · Zero Incident`;
    bindShell();
    bindPasswordToggles(root);
    bindChecklist(root);
    const cleanup = page.mount?.(root);
    disposePage = typeof cleanup === "function" ? cleanup : null;
    window.scrollTo(0, 0);
  } catch (e) {
    if (currentRevision !== revision) return;
    if (e.status === 401) {
      await refreshSession();
      navigate("/login");
      return;
    }
    disposePage?.();
    disposePage = null;
    root.innerHTML = `<div class="error-screen">${icon("alert", 40)}<h1>Let’s try that again.</h1><p>${esc(e.message)}</p><button class="btn btn-primary" id="retry-page">${icon("refresh", 16)}Reload workspace</button></div>`;
    root.querySelector("#retry-page").addEventListener("click", async () => {
      await refreshSession().catch(() => {});
      render();
    });
  } finally {
    root.removeAttribute("aria-busy");
  }
}
window.addEventListener("hashchange", () => {
  closeModal();
  render();
});
window.addEventListener("session-ended", () => {
  if (state.user) {
    state.user = null;
    refreshSession().then(() => navigate("/login"));
    notify("Your session ended. Please sign in again.", "error");
  }
});
window.addEventListener("password-required", () => {
  if (state.user) {
    state.user.mustChangePassword = true;
    navigate("/first-password");
  }
});
window.addEventListener("resize", syncSidebarAccess);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && root.querySelector(".sidebar.is-open")) {
    root.querySelector("[data-sidebar-close]")?.click();
    root.querySelector("[data-sidebar-open]")?.focus();
  }
});
window.addEventListener("storage", (event) => {
  if (
    acceptThemeStorageEvent(event) &&
    state.user &&
    !state.user.mustChangePassword &&
    document.body.dataset.role === state.user.role
  ) {
    applyWorkspaceTheme(state.user.role);
    updateThemeControls();
  }
});
// Colour the loading screen from the saved preference, before the session arrives.
if (location.hash.startsWith("#/admin/")) applyWorkspaceTheme("admin");
else if (location.hash.startsWith("#/employee/"))
  applyWorkspaceTheme("employee");
else if (location.hash.startsWith("#/trainer/"))
  applyWorkspaceTheme("trainer");
else applyLoginTheme();
try {
  await refreshSession();
  await render();
} catch (e) {
  root.innerHTML = `<div class="error-screen">${icon("alert", 40)}<h1>Unable to reach the workspace</h1><p>${esc(e.message)}</p><button class="btn btn-primary" id="retry-connection">Try again</button></div>`;
  document.getElementById("retry-connection").onclick = () => location.reload();
}
