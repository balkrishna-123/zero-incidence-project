import { icon } from "./icons.js";
import {
  esc,
  avatar,
  fullName,
  statusBadge,
  progressBadge,
  formatDate,
  timeAgo,
  notify,
  modal,
  closeModal,
  formError,
  busy,
  passwordField,
  passwordChecklist,
  bindPasswordToggles,
  bindChecklist,
  generatePassword,
  copy,
  empty,
  moduleMeta,
} from "./ui.js";

const heading = (title, subtitle, action = "", eyebrow = "") =>
  `<div class="page-heading"><div>${eyebrow ? `<div class="page-eyebrow">${eyebrow}</div>` : ""}<h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
const addEmployee = `<a class="btn btn-primary" href="#/admin/employees/new">${icon("plus", 16)}Register employee</a>`;
const scoreView = (m) =>
  m.score === null
    ? '<span class="score none">—</span>'
    : `<span class="score ${m.score >= 85 ? "excellent" : m.score >= 70 ? "pass" : "fail"}">${icon(m.score >= 70 ? "checkCircle" : "refresh", 13)}${m.score}<small>/100</small></span>`;
const miniProgress = (p) =>
  `<div class="progress-mini"><span class="progress-track"><span style="width:${p.percent}%"></span></span><span class="progress-mini-label">${p.passed} / 3</span></div>`;
const person = (user) =>
  `<button class="person person-button" data-detail="${user.id}">${avatar(user)}<span><strong>${esc(fullName(user))}${user.role === "trainer" ? `<span class="badge neutral" style="font-size:8px;padding:1px 6px;margin-left:6px;vertical-align:2px">Trainer</span>` : ""}</strong><small>${esc(user.employeeNumber)}</small></span></button>`;
function employeeActions(e) {
  return `<div class="row-actions"><a class="icon-button" href="#/admin/employees/${e.id}/edit" title="Edit employee" aria-label="Edit ${esc(fullName(e))}">${icon("edit")}</a><button class="icon-button" data-reset="${e.id}" title="Reset temporary password" aria-label="Reset password for ${esc(fullName(e))}">${icon("key")}</button><button class="icon-button" data-status="${e.id}" title="${e.status === "active" ? "Deactivate" : "Reactivate"} account" aria-label="${e.status === "active" ? "Deactivate" : "Reactivate"} ${esc(fullName(e))}">${icon(e.status === "active" ? "pause" : "play")}</button><button class="icon-button" data-delete="${e.id}" title="Delete employee" aria-label="Delete ${esc(fullName(e))}">${icon("trash")}</button></div>`;
}
function statCard(label, value, note, symbol, tone = "") {
  return `<div class="stat-card"><div class="stat-label">${label}<span class="stat-icon ${tone}">${icon(symbol, 16)}</span></div><div class="stat-number">${value}</div><div class="stat-note">${tone === "green-icon" ? "<i></i>" : ""}${note}</div></div>`;
}
async function showEmployee(ctx, id) {
  try {
    const {
      employee: e,
      progress: p,
      completion,
      passwordStorage: ps,
      modulePercents = {},
      overallPercent: overallPct = 0,
    } = await ctx.api.get(`/admin/employees/${id}`);
    modal({
      title: "Employee overview",
      subtitle: "Account details and learning progress",
      className: "wide",
      content: `
      <div class="detail-header">${avatar(e, "avatar-lg")}<div><h3>${esc(fullName(e))}</h3><p>${esc(e.employeeNumber)} &nbsp;·&nbsp; ${esc(e.username)}</p></div><div style="margin-left:auto">${statusBadge(e.status)}</div></div>
      <dl class="detail-grid"><div><dt>AGE</dt><dd>${e.age} years</dd></div><div><dt>REGISTERED</dt><dd>${formatDate(e.createdAt)}</dd></div><div><dt>LAST SIGN-IN</dt><dd>${formatDate(e.lastLoginAt)}</dd></div><div><dt>PASSWORD SETUP</dt><dd>${e.mustChangePassword ? "Change required" : "Complete"}</dd></div><div><dt>MODULES PASSED</dt><dd>${p.passed} of 3</dd></div><div><dt>COMPLETED</dt><dd>${overallPct}% of all three modules</dd></div><div><dt>OVERALL SCORE</dt><dd>${p.overallScore === null ? "Awaiting all scores" : `${p.overallScore} / 100`}</dd></div></dl>
      <div class="password-storage"><small>PASSWORD STORAGE — HASH ONLY, NEVER THE WORD ITSELF</small><code>${esc(ps.fullHash)}</code><p>${icon("lock", 13)} <span>${esc(ps.parameters)} · random 16-byte salt per account · ${ps.length} characters · checked with constant-time comparison</span></p></div>
      <div class="section-title"><h2>Learning progress</h2>${progressBadge(p.status)}</div><div class="detail-modules">${p.modules.map((m) => `<div class="detail-module"><span class="module-small-icon">${icon(moduleMeta[m.key].icon)}</span><div><strong>${moduleMeta[m.key].short}</strong><small>${m.score === null ? "Not yet assessed" : `${m.classification} · ${m.attempts} attempt${m.attempts === 1 ? "" : "s"}`}</small><span class="module-percent-bar" title="${modulePercents[m.key] ?? 0}% of this module finished"><i style="width:${modulePercents[m.key] ?? 0}%"></i></span></div><span class="module-percent">${modulePercents[m.key] ?? 0}%</span>${scoreView(m)}</div>`).join("")}</div>
      <div class="info-callout">${icon(p.eligible ? "award" : "info", 17)}<span>${p.eligible ? "The displayed scores meet the threshold. Only verified completed assessments count for the certificate." : "Every module must reach 70/100 before this employee becomes eligible for certification."}${p.hasDemoScores ? "<br><strong>These scores are labelled demonstration records.</strong>" : ""}</span></div>`,
      footer: `<button class="btn btn-secondary" data-close-modal>Close</button><a class="btn btn-secondary" href="#/admin/certificates/${e.id}">${icon("award", 14)}Completion record</a><a class="btn btn-primary" href="#/admin/employees/${e.id}/edit">${icon("edit", 14)}Edit account</a>`,
    });
  } catch (e) {
    notify(e.message, "error");
  }
}
function credentialsDialog(ctx, employee, temporaryPassword, afterClose) {
  modal({
    title: "Ready for a safer start.",
    subtitle: `Credentials for ${fullName(employee)}`,
    content: `
    <div class="credential-success">${icon("checkCircle", 27)}</div><p>The account is ready. Share these credentials through a secure channel. The employee must create a new password at first sign-in.</p>
    <div class="credential-box"><div><label>USERNAME</label><code>${esc(employee.username)}</code></div><div><label>TEMPORARY PASSWORD — SHOWN ONCE</label><code>${esc(temporaryPassword)}</code></div></div>
    <div class="info-callout credential-copy-hint">${icon("lock", 16)}<span>Only a salted password hash is stored. This password will not be shown again after you close this window.</span></div>`,
    footer: `<button class="btn btn-secondary" id="print-credentials">${icon("print", 14)}Print</button><button class="btn btn-secondary" id="copy-credentials">${icon("copy", 14)}Copy credentials</button><button class="btn btn-primary" data-close-modal>Done</button>`,
    onMount(el) {
      el.querySelector("#copy-credentials").onclick = () =>
        copy(
          `Zero Incident\nEmployee: ${fullName(employee)}\nUsername: ${employee.username}\nTemporary password: ${temporaryPassword}\nYou must change your password at first login.`,
        );
      el.querySelector("#print-credentials").onclick = () => window.print();
    },
    onClose() {
      temporaryPassword = "";
      afterClose?.();
    },
  });
}
function toggleStatus(ctx, record, type = "employees") {
  const active = record.status === "active";
  const label = type === "employees" ? fullName(record) : record.nickname;
  modal({
    title: `${active ? "Deactivate" : "Reactivate"} ${type === "employees" ? "account" : "trainer"}?`,
    subtitle: label,
    content: `<p>${active ? (type === "employees" ? "This employee will be signed out immediately and cannot sign in again until reactivated. Their details and training progress will be preserved." : "This virtual trainer will no longer appear to employees. Module assignments are preserved, so reactivation restores the guide.") : type === "employees" ? "This employee will be able to sign in again. If a password change is pending, it will still be required." : "This virtual trainer will appear in its assigned module introductions again."}</p><form id="status-form"><div class="form-alert" hidden></div></form>`,
    footer: `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn ${active ? "btn-danger" : "btn-primary"}" id="confirm-status">${icon(active ? "pause" : "play", 14)}${active ? "Deactivate" : "Reactivate"}</button>`,
    onMount(el, close) {
      el.querySelector("#confirm-status").onclick = async (e) => {
        busy(e.currentTarget, true);
        try {
          await ctx.api.patch(`/admin/${type}/${record.id}/status`, {
            status: active ? "inactive" : "active",
          });
          await ctx.render();
          close();
          notify(
            `${type === "employees" ? "Account" : "Trainer"} ${active ? "deactivated" : "reactivated"}.`,
          );
        } catch (error) {
          formError(el.querySelector("form"), error);
          busy(el.querySelector("#confirm-status"), false);
        }
      };
    },
  });
}
function deleteRecord(ctx, record, type = "employees") {
  const confirmation = type === "employees" ? record.username : record.nickname;
  modal({
    title: `Permanently delete ${type === "employees" ? "employee" : "trainer"}?`,
    subtitle: type === "employees" ? fullName(record) : record.nickname,
    content: `<p>${type === "employees" ? "The account and all of its training progress will be deleted. Existing sessions will lose access immediately. Audit history is retained." : "The trainer profile and its uploaded image will be deleted. Modules assigned to this trainer will become unassigned."} <strong>This cannot be undone.</strong></p><form id="delete-form" class="mt-24"><div class="form-alert" hidden></div><div class="field"><label for="confirmation">Type <strong>${esc(confirmation)}</strong> to confirm<b>*</b></label><input name="confirmation" id="confirmation" required autocomplete="off" placeholder="${esc(confirmation)}" autofocus></div></form>`,
    footer: `<button class="btn btn-secondary" data-close-modal>Keep ${type === "employees" ? "employee" : "trainer"}</button><button class="btn btn-danger" form="delete-form" type="submit">${icon("trash", 14)}Delete permanently</button>`,
    onMount(el, close) {
      el.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const button = el.querySelector('[type="submit"]');
        busy(button, true, "Deleting…");
        try {
          await ctx.api.delete(`/admin/${type}/${record.id}`, {
            confirmation: form.confirmation.value,
          });
          await ctx.render();
          close();
          notify(
            `${type === "employees" ? "Employee account and progress" : "Virtual trainer"} deleted.`,
          );
        } catch (error) {
          formError(form, error);
          busy(button, false);
        }
      };
    },
  });
}
function resetPassword(ctx, employee) {
  modal({
    title: "Reset temporary password",
    subtitle: `${fullName(employee)} · ${employee.username}`,
    content: `<p>This revokes every existing session. The employee must choose a new password at their next sign-in.</p><form id="reset-password-form" class="mt-24"><div class="form-alert" hidden></div><div class="flex between mb-24"><span class="small muted">Issue new temporary credentials</span><button type="button" class="text-button red-text" id="generate-reset">${icon("sparkles", 14)}Generate</button></div>${passwordField("temporaryPassword", "Temporary password", { id: "resetTemporary" })}${passwordField("confirmPassword", "Confirm temporary password", { id: "resetConfirm" })}${passwordChecklist("resetTemporary")}</form>`,
    footer: `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" form="reset-password-form" type="submit">${icon("key", 14)}Reset password</button>`,
    onMount(el, close) {
      bindChecklist(el);
      const form = el.querySelector("form");
      el.querySelector("#generate-reset").onclick = () => {
        const p = generatePassword();
        form.temporaryPassword.value = p;
        form.confirmPassword.value = p;
        form.temporaryPassword.dispatchEvent(new Event("input"));
        notify("Strong temporary password generated.");
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const button = el.querySelector('[type="submit"]');
        busy(button, true, "Resetting…");
        try {
          const password = form.temporaryPassword.value;
          await ctx.api.post(`/admin/employees/${employee.id}/reset-password`, {
            temporaryPassword: password,
            confirmPassword: form.confirmPassword.value,
          });
          form.reset();
          close();
          credentialsDialog(ctx, employee, password, () => ctx.render());
        } catch (error) {
          formError(form, error);
          busy(button, false);
        }
      };
    },
  });
}
function bindEmployees(root, records, ctx) {
  root
    .querySelectorAll("[data-detail]")
    .forEach((b) => (b.onclick = () => showEmployee(ctx, b.dataset.detail)));
  root.querySelectorAll("[data-status]").forEach(
    (b) =>
      (b.onclick = () =>
        toggleStatus(
          ctx,
          records.find((e) => e.id === b.dataset.status),
        )),
  );
  root.querySelectorAll("[data-reset]").forEach(
    (b) =>
      (b.onclick = () =>
        resetPassword(
          ctx,
          records.find((e) => e.id === b.dataset.reset),
        )),
  );
  root.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = () =>
        deleteRecord(
          ctx,
          records.find((e) => e.id === b.dataset.delete),
        )),
  );
}
async function overview(ctx) {
  const d = await ctx.api.get("/admin/overview");
  const s = d.stats;
  const assigned = d.modules.filter((m) => m.trainer).length;
  return {
    title: "Overview",
    html: `${heading("A safer start, for everyone.", "A little awareness today. A safer workplace tomorrow.", addEmployee, "YOUR SAFETY WORKSPACE")}
    <div class="stat-grid">${statCard("Total employees", s.total, "People in your workspace", "users")}${statCard("Active accounts", s.active, "Ready to learn", "user", "green-icon")}${statCard("Awaiting first sign-in setup", s.onboarding, "Password change pending", "key", "amber-icon")}${statCard("Training complete", s.complete, "All 3 modules passed", "award", "red-icon")}</div>
    ${s.pendingApplications ? `<div class="info-callout mt-24">${icon("send", 16)}<span><strong>${s.pendingApplications} pending application${s.pendingApplications === 1 ? "" : "s"}.</strong> Review trainer and administrator applications. <a href="#/admin/applications">Review now ${icon("arrow", 11)}</a></span></div>` : ""}
    ${s.openTrainerReports ? `<div class="info-callout mt-24">${icon("alert", 16)}<span><strong>${s.openTrainerReports} trainer report${s.openTrainerReports === 1 ? "" : "s"} waiting.</strong> An employee flagged a guide that may not be helping effectively. <a href="#/admin/reports">Review now ${icon("arrow", 11)}</a></span></div>` : ""}
    <div class="overview-top"><section class="welcome-banner"><div class="eyebrow">BUILT FOR A ZERO-INCIDENT MINDSET</div><h2>Build awareness.<br>Prevent incidents.</h2><p>Give every new starter the knowledge and confidence to make safer decisions.</p><div class="banner-numbers"><span><strong>03</strong>Core safety modules</span><i></i><span><strong>70%</strong>Minimum pass score</span></div><div class="banner-art">${icon("helmet", 96)}</div></section>
    <section class="panel checklist-panel"><h2>Your onboarding essentials</h2><p>Three simple steps to a safer start.</p><a class="setup-item" href="#/admin/employees"><span class="setup-icon ${s.total ? "done" : ""}">${s.total ? icon("check", 13) : "1"}</span><div><strong>Bring your people on board</strong><p>${s.total} employee account${s.total === 1 ? "" : "s"} registered</p></div>${icon("chevron")}</a><a class="setup-item" href="#/admin/trainers"><span class="setup-icon ${assigned === 3 ? "done" : ""}">${assigned === 3 ? icon("check", 13) : "2"}</span><div><strong>Give every module a guide</strong><p>${assigned} of 3 modules have an active trainer</p></div>${icon("chevron")}</a><a class="setup-item" href="#/admin/progress"><span class="setup-icon">${icon("chart", 13)}</span><div><strong>Follow their safety journey</strong><p>View results and identify support needs</p></div>${icon("chevron")}</a></section></div>
    <div class="overview-bottom"><section class="panel"><header class="panel-head"><div><h2>Recent employees</h2><p>Your newest starters, all in one place.</p></div><a class="text-button" href="#/admin/employees">View all ${icon("arrow", 13)}</a></header>${d.employees.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Employee</th><th>Status</th><th class="progress-col">Modules passed</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>${d.employees.map((e) => `<tr><td>${person(e)}</td><td>${statusBadge(e.status)}</td><td class="progress-col">${miniProgress(e.progress)}</td><td style="padding-left:0"><button class="icon-button" data-detail="${e.id}" aria-label="View ${esc(fullName(e))}">${icon("chevron", 15)}</button></td></tr>`).join("")}</tbody></table></div>` : empty("Your first employee starts here", "Register an employee to begin their onboarding journey.")}</section>
    <section class="panel"><header class="panel-head"><div><h2>Recent activity</h2><p>The latest in your workspace.</p></div>${icon("clock", 15)}</header><div class="activity-list">${d.events
      .slice(0, 4)
      .map(
        (e) =>
          `<div class="activity-item"><span class="activity-dot">${icon(e.action.includes("trainer") ? "trainer" : e.action.includes("password") ? "key" : "user", 14)}</span><div><p><strong>${esc(e.actorName)}</strong> ${esc(e.action)}</p><small>${esc(e.subject)}</small></div><time>${timeAgo(e.createdAt)}</time></div>`,
      )
      .join("")}</div></section></div>`,
    mount(root) {
      bindEmployees(root, d.employees, ctx);
    },
  };
}
function employeeTable(data) {
  return `${data.employees.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Employee</th><th>Username</th><th>Account status</th><th>Modules passed</th><th>Registered</th><th style="text-align:right">Actions</th></tr></thead><tbody>${data.employees.map((e) => `<tr><td>${person(e)}</td><td><span style="color:var(--text)">${esc(e.username)}</span>${e.mustChangePassword ? '<div class="tiny" style="font-size:8px;color:#b79b69;margin-top:5px">Password setup pending</div>' : '<div class="tiny" style="font-size:8px;color:var(--subtle);margin-top:5px">Password secured</div>'}</td><td>${statusBadge(e.status)}</td><td>${miniProgress(e.progress)}</td><td class="tiny" style="font-size:9px">${formatDate(e.createdAt)}</td><td>${employeeActions(e)}</td></tr>`).join("")}</tbody></table></div>` : empty("No employees found", "Try another search or register a new employee.")}<footer class="table-footer"><span>${data.total ? `Showing ${(data.page - 1) * 10 + 1}–${Math.min(data.page * 10, data.total)} of ${data.total} employees` : "0 employees"}</span><div class="pagination"><button class="icon-button" data-page="${data.page - 1}" ${data.page <= 1 ? "disabled" : ""} aria-label="Previous page">${icon("back", 13)}</button><span class="page-number">${data.page}</span><span>of ${data.pages}</span><button class="icon-button" data-page="${data.page + 1}" ${data.page >= data.pages ? "disabled" : ""} aria-label="Next page">${icon("arrow", 13)}</button></div></footer>`;
}
async function employeesPage(ctx) {
  let data = await ctx.api.get("/admin/employees");
  let status = "",
    search = "",
    page = 1,
    serial = 0;
  return {
    title: "Manage employees",
    html: `${heading("Manage employees", "Create accounts, manage access, and help your people get started.", addEmployee)}<section class="panel"><div class="table-toolbar"><div class="filter-tabs">${[
      ["", "All employees", data.counts.all],
      ["active", "Active", data.counts.active],
      ["inactive", "Inactive", data.counts.inactive],
    ]
      .map(
        ([key, label, count]) =>
          `<button class="filter-tab ${!key ? "active" : ""}" data-filter="${key}">${label}<span>${count}</span></button>`,
      )
      .join(
        "",
      )}</div><div class="search-wrap">${icon("search")}<input id="employee-search" type="search" placeholder="Search name, username or employee ID…" aria-label="Search employees" maxlength="80"></div></div><div id="employee-results">${employeeTable(data)}</div></section><div class="info-callout mt-24">${icon("shield", 16)}<span>Every new employee must change their temporary password before accessing training. Deactivation preserves progress; deletion removes it permanently.</span></div>`,
    mount(root) {
      const results = root.querySelector("#employee-results");
      function bind() {
        bindEmployees(results, data.employees, ctx);
        results.querySelectorAll("[data-page]").forEach(
          (b) =>
            (b.onclick = () => {
              page = Number(b.dataset.page);
              load();
            }),
        );
      }
      async function load() {
        const requestId = ++serial;
        results.setAttribute("aria-busy", "true");
        try {
          const response = await ctx.api.get(
            `/admin/employees?${new URLSearchParams({ status, search, page })}`,
          );
          if (requestId !== serial) return;
          data = response;
          results.innerHTML = employeeTable(data);
          bind();
        } catch (e) {
          notify(e.message, "error");
        } finally {
          results.removeAttribute("aria-busy");
        }
      }
      bind();
      root.querySelectorAll("[data-filter]").forEach(
        (b) =>
          (b.onclick = () => {
            status = b.dataset.filter;
            page = 1;
            root
              .querySelectorAll("[data-filter]")
              .forEach((t) => t.classList.toggle("active", t === b));
            load();
          }),
      );
      let debounce;
      root.querySelector("#employee-search").addEventListener("input", (e) => {
        search = e.target.value;
        page = 1;
        clearTimeout(debounce);
        debounce = setTimeout(load, 250);
      });
    },
  };
}
const inputField = (key, label, value = "", options = "") =>
  `<div class="field"><label for="${key}">${label}</label><input id="${key}" name="${key}" value="${esc(value)}" ${options}></div>`;
async function employeeForm(ctx, id) {
  const employee = id
    ? (await ctx.api.get(`/admin/employees/${id}`)).employee
    : null;
  return {
    title: employee ? "Edit employee" : "Register employee",
    breadcrumb: employee
      ? "Manage employees / Edit employee"
      : "Manage employees / Register employee",
    html: `<a class="back-link" href="#/admin/employees">${icon("back")}Back to employees</a>${heading(employee ? "Edit employee" : "Register employee", employee ? `Manage account information for ${esc(fullName(employee))}.` : "A safer first day starts with a secure account.")}
    <div class="form-layout"><form class="panel form-panel" id="employee-form"><header class="panel-head"><h2>${employee ? "Employee details" : "Register a new employee"}</h2><span>Fields marked <span class="red-text">*</span> are required</span></header><div class="form-content"><div class="form-alert" hidden></div><div class="form-section-title">${icon("user")}Personal information</div><div class="form-grid">
    ${inputField("firstName", "FIRST NAME <b>*</b>", employee?.firstName, 'required maxlength="60" placeholder="e.g. Ramesh" autocomplete="given-name"')}${inputField("lastName", "LAST NAME <b>*</b>", employee?.lastName, 'required maxlength="60" placeholder="e.g. Shrestha" autocomplete="family-name"')}
    <div class="field"><label for="age">AGE <b>*</b></label><input id="age" name="age" type="number" min="16" max="100" step="1" placeholder="e.g. 28" value="${employee?.age || ""}" required><small>Must be 16 or older.</small></div><div class="field"><label for="employeeNumber">EMPLOYEE ID</label><input id="employeeNumber" name="employeeNumber" maxlength="30" pattern="[A-Za-z0-9-]*" placeholder="Auto-generated if left blank" value="${esc(employee?.employeeNumber)}"><small>A unique reference for your employee.</small></div></div>
    <div class="form-section-title">${icon("lock")}Account access</div><div class="form-grid"><div class="field full"><label for="username">USERNAME <b>*</b></label><input id="username" name="username" required minlength="3" maxlength="40" pattern="[A-Za-z0-9][A-Za-z0-9._\\-]{2,39}" placeholder="e.g. r.shrestha" value="${esc(employee?.username)}" autocomplete="off" autocapitalize="none" spellcheck="false"><small>Used to sign in. Must be unique. Letters, numbers, dots, hyphens and underscores.</small></div>
    ${!employee ? `<div class="field"><div class="field-label-row"><label for="temporaryPassword">TEMPORARY PASSWORD <b>*</b></label><button class="text-button red-text" id="generate-password" type="button">${icon("sparkles", 12)}Generate</button></div><div class="input-wrap"><input name="temporaryPassword" id="temporaryPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="Create a temporary password"><button class="password-toggle" type="button" data-toggle-password="temporaryPassword" aria-label="Show password">${icon("eye", 17)}</button></div></div>${passwordField("confirmPassword", "CONFIRM PASSWORD", { placeholder: "Re-enter temporary password" })}` : ""}
    <div class="field full"><label for="status">ACCOUNT STATUS <b>*</b></label><select name="status" id="status"><option value="active" ${employee?.status !== "inactive" ? "selected" : ""}>Active</option><option value="inactive" ${employee?.status === "inactive" ? "selected" : ""}>Inactive</option></select></div></div>
    ${!employee ? `${passwordChecklist("temporaryPassword")}<div class="enforced-checks"><div class="enforced-check"><span>${icon("check")}</span>Require password change on first login<em>ALWAYS ON</em></div><div class="enforced-check"><span>${icon("check")}</span>Assign all three mandatory safety modules<em>ALWAYS ON</em></div></div>` : `<div class="info-callout mt-24">${icon("key", 16)}<span>Use the key action in Manage employees to issue a new temporary password. Passwords cannot be viewed.</span></div>`}</div>
    <footer class="form-actions"><a class="btn btn-ghost" href="#/admin/employees">Cancel</a><button class="btn btn-primary" type="submit">${icon(employee ? "check" : "plus", 15)}${employee ? "Save changes" : "Create account"}</button></footer></form>
    <aside class="form-aside"><section class="panel info-panel"><h3>${icon("shield")}Password policy</h3><ul class="info-list"><li>Between <strong>8 and 128 characters</strong></li><li>At least one uppercase letter and one number</li><li>Individually salted and hashed — never stored in plain text</li><li>Employees must change their temporary password at first sign-in</li></ul></section><section class="panel info-panel"><h3>${icon("arrow")}What happens next?</h3><ul class="info-list"><li>Credentials are shown <strong>once</strong>, ready to copy or print.</li><li>The employee sets their own password, then returns to the login page.</li><li>All three safety modules appear in their training hub.</li><li>Their account appears immediately under Manage employees.</li></ul></section><div class="info-callout">${icon("lock")}<span>Share temporary credentials securely. Never send a password in a public or group conversation.</span></div></aside></div>`,
    mount(root) {
      const form = root.querySelector("#employee-form");
      root
        .querySelector("#generate-password")
        ?.addEventListener("click", () => {
          const p = generatePassword();
          form.temporaryPassword.value = p;
          form.confirmPassword.value = p;
          form.temporaryPassword.dispatchEvent(new Event("input"));
          notify("Strong temporary password generated.");
        });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const button = form.querySelector('[type="submit"]');
        busy(button, true, employee ? "Saving changes…" : "Creating account…");
        try {
          const input = Object.fromEntries(new FormData(form));
          input.age = Number(input.age);
          const result = await (employee
            ? ctx.api.patch(`/admin/employees/${employee.id}`, input)
            : ctx.api.post("/admin/employees", input));
          if (employee) {
            notify("Employee details updated.");
            ctx.navigate("/admin/employees");
          } else {
            const password = input.temporaryPassword;
            form.reset();
            credentialsDialog(ctx, result.employee, password, () =>
              ctx.navigate("/admin/employees"),
            );
          }
        } catch (error) {
          formError(form, error);
        } finally {
          busy(button, false);
        }
      });
    },
  };
}
function trainerCards(trainers) {
  return `${trainers.map((t) => `<article class="panel trainer-card"><div class="trainer-card-top"><div class="trainer-portrait"><img src="${esc(t.imageUrl)}" alt="${esc(t.nickname)} trainer profile"></div>${statusBadge(t.status)}</div><h2>${esc(t.nickname)}</h2><p class="legal-name">${esc(fullName(t))} &nbsp;·&nbsp; ${t.accountUsername ? `Signs in as <span style="color:var(--text);font-weight:550">@${esc(t.accountUsername)}</span>` : "Virtual safety guide"}</p><p class="trainer-intro">“${esc(t.introduction || "No introduction set yet.")}”</p><div class="trainer-tags">${t.moduleKeys.length ? t.moduleKeys.map((key) => `<span class="badge neutral">${moduleMeta[key].short}</span>`).join("") : '<span class="badge gray">No modules assigned</span>'}<span class="badge ${t.eligibility?.eligible ? "green" : "neutral"}" title="Employees certified under this trainer’s guidance">${icon("award", 12)} ${t.eligibility?.certified ?? 0} certified</span>${t.permissions?.viewProgress ? '<span class="badge blue">Views progress</span>' : ""}${t.permissions?.resetPassword ? '<span class="badge green">Resets passwords</span>' : ""}</div><div class="trainer-actions"><a class="btn btn-secondary btn-sm" href="#/admin/trainers/${t.id}/edit">${icon("edit", 13)}Edit profile</a><button class="icon-button" data-trainer-status="${t.id}" title="${t.status === "active" ? "Deactivate" : "Reactivate"} trainer" aria-label="${t.status === "active" ? "Deactivate" : "Reactivate"} ${esc(t.nickname)}">${icon(t.status === "active" ? "pause" : "play", 16)}</button><button class="icon-button" data-trainer-delete="${t.id}" title="Delete trainer" aria-label="Delete ${esc(t.nickname)}">${icon("trash", 16)}</button></div></article>`).join("")}<a href="#/admin/trainers/new" class="trainer-add"><span>${icon("plus", 23)}</span><strong>A new face for safer learning</strong><p>Create a virtual trainer to welcome, guide and encourage your employees.</p><span class="text-button red-text mt-24" style="width:auto;height:auto;background:transparent;font-size:10px;margin-bottom:0">Create trainer ${icon("arrow", 12)}</span></a>`;
}
async function trainersPage(ctx) {
  const data = await ctx.api.get("/admin/trainers");
  return {
    title: "Virtual trainers",
    html: `${heading("Meet your safety guides.", "A friendly face for every learning journey. Trainers sign in with the ID and password you provide.", `<a class="btn btn-primary" href="#/admin/trainers/new">${icon("plus", 16)}Create trainer</a>`)}<div class="scope-note">${icon("trainer", 17)}<span><strong>Guides with a login.</strong> Each trainer gets a sign-in you create, plus permissions you assign — viewing employee progress and resetting passwords. Trainers can never delete employee IDs. All three module scores are calculated by the assessment system, not the trainer character.</span></div><div class="section-title"><h2 id="trainer-count">${data.trainers.length} virtual trainer${data.trainers.length === 1 ? "" : "s"}</h2><div class="search-wrap">${icon("search")}<input type="search" id="trainer-search" placeholder="Find a trainer…" aria-label="Search trainers"></div></div><div class="trainer-grid" id="trainer-results">${trainerCards(data.trainers)}</div>`,
    mount(root) {
      const results = root.querySelector("#trainer-results");
      function bind() {
        results.querySelectorAll("[data-trainer-status]").forEach(
          (b) =>
            (b.onclick = () =>
              toggleStatus(
                ctx,
                data.trainers.find((t) => t.id === b.dataset.trainerStatus),
                "trainers",
              )),
        );
        results.querySelectorAll("[data-trainer-delete]").forEach(
          (b) =>
            (b.onclick = () =>
              deleteRecord(
                ctx,
                data.trainers.find((t) => t.id === b.dataset.trainerDelete),
                "trainers",
              )),
        );
      }
      bind();
      root.querySelector("#trainer-search").oninput = (e) => {
        const q = e.target.value.toLowerCase().trim();
        const records = data.trainers.filter((t) =>
          `${fullName(t)} ${t.nickname}`.toLowerCase().includes(q),
        );
        root.querySelector("#trainer-count").textContent =
          `${records.length} virtual trainer${records.length === 1 ? "" : "s"}`;
        results.innerHTML = trainerCards(records);
        bind();
      };
    },
  };
}
async function trainerForm(ctx, id) {
  const data = await ctx.api.get(
    id ? `/admin/trainers/${id}` : "/admin/trainers",
  );
  const trainer = data.trainer;
  return {
    title: trainer ? "Edit trainer" : "Create trainer",
    breadcrumb: `Virtual trainers / ${trainer ? "Edit profile" : "Create trainer"}`,
    html: `<a class="back-link" href="#/admin/trainers">${icon("back")}Back to virtual trainers</a>${heading(trainer ? "Edit your safety guide." : "Introduce a new safety guide.", "Give your virtual trainer a name, a face, and a friendly introduction.")}<div class="form-layout"><form class="panel form-panel" id="trainer-form"><header class="panel-head"><h2>Trainer profile</h2><span>Fields marked <span class="red-text">*</span> are required</span></header><div class="form-content"><div class="form-alert" hidden></div><div class="photo-upload" id="photo-drop"><div class="photo-preview" id="photo-preview">${trainer ? `<img src="${esc(trainer.imageUrl)}" alt="Current trainer picture">` : icon("image", 27)}</div><div><strong>Profile picture <span class="red-text">*</span></strong><p>JPG, PNG or WebP · up to 5 MB / 20 MP</p><input type="file" name="image" id="trainer-image" class="sr-only" accept="image/jpeg,image/png,image/webp"><label class="btn btn-secondary btn-sm" for="trainer-image">${icon("upload", 12)}${trainer ? "Change picture" : "Upload picture"}</label></div></div><div class="form-grid">${inputField("firstName", "FIRST NAME <b>*</b>", trainer?.firstName, 'required maxlength="60" placeholder="e.g. Yeti"')}${inputField("lastName", "LAST NAME <b>*</b>", trainer?.lastName, 'required maxlength="60" placeholder="e.g. Guide"')}${inputField("nickname", "DISPLAY NICKNAME <b>*</b>", trainer?.nickname, 'required maxlength="30" placeholder="e.g. Yeti"')}${inputField("age", 'CHARACTER AGE <span class="muted">(optional)</span>', trainer?.age, 'type="number" min="16" max="100" step="1" placeholder="e.g. 28"')}<div class="field full"><label for="introduction">WELCOME INTRODUCTION</label><textarea name="introduction" id="introduction" maxlength="600" placeholder="Welcome to Zero Incident! I’m Yeti, your safety guide…">${esc(trainer?.introduction)}</textarea><small>Shown in the employee hub and module overview. Plain text, up to 600 characters.</small></div><div class="field full"><label for="status">TRAINER STATUS</label><select name="status" id="status"><option value="active" ${trainer?.status !== "inactive" ? "selected" : ""}>Active</option><option value="inactive" ${trainer?.status === "inactive" ? "selected" : ""}>Inactive</option></select></div></div><div class="form-section-title">${icon("key")}Sign-in & permissions</div>${trainer ? `<div class="field full"><label for="account-username">SIGN-IN USERNAME</label><div class="input-wrap"><input type="text" id="account-username" value="${esc(trainer.accountUsername || "No account linked")}" readonly disabled></div><small>The sign-in username can’t be changed. Use the reset button below to issue a new temporary password.</small><div style="margin-top:12px"><button type="button" class="btn btn-secondary btn-sm" id="trainer-reset-pw">${icon("key", 13)}Reset password</button></div></div>` : `${inputField("username", "SIGN-IN USERNAME <b>*</b>", "", 'required maxlength="80" placeholder="e.g. yeti" autocomplete="off"')}${passwordField("temporaryPassword", "TEMPORARY PASSWORD <b>*</b>", { placeholder: "e.g. SafeSite!2026" })}${passwordField("confirmPassword", "CONFIRM PASSWORD <b>*</b>", { placeholder: "Repeat the temporary password" })}`}<div class="field full"><label>ASSIGNED PERMISSIONS</label><div class="module-select-list"><label class="module-select-item"><span class="module-small-icon">${icon("chart")}</span><span><strong>View employee progress</strong><small>Trainer can open the employee progress page</small></span><input type="checkbox" name="permission-view" ${trainer?.permissions?.viewProgress ? "checked" : ""}></label><label class="module-select-item"><span class="module-small-icon">${icon("key")}</span><span><strong>Reset employee passwords</strong><small>Trainer can issue a new temporary password</small></span><input type="checkbox" name="permission-reset" ${trainer?.permissions?.resetPassword ? "checked" : ""}></label></div><small>Permissions apply immediately. Deleting employee IDs is never available to trainers.</small></div><div class="form-section-title">${icon("book")}Module assignments</div><div class="module-select-list">${data.modules.map((m) => `<label class="module-select-item"><span class="module-small-icon">${icon(moduleMeta[m.key].icon)}</span><span><strong>${esc(m.title)}</strong><small>${m.trainer ? `Current guide: ${esc(m.trainer.nickname)}` : "No active guide assigned"}</small></span><input type="checkbox" name="moduleKeys" value="${m.key}" ${trainer?.moduleKeys.includes(m.key) ? "checked" : ""}></label>`).join("")}</div><p class="small muted mt-16" style="font-size:9px;line-height:1.8">Selecting a module replaces its current guide. Unchecking an assigned module leaves it unassigned. Inactive guides are not shown to employees.</p></div><footer class="form-actions"><a class="btn btn-ghost" href="#/admin/trainers">Cancel</a><button class="btn btn-primary" type="submit">${icon(trainer ? "check" : "plus", 15)}${trainer ? "Save trainer" : "Create trainer"}</button></footer></form><aside class="form-aside"><section class="panel info-panel"><h3>${icon("key")}Sign-in & permissions</h3><ul class="info-list"><li>Each trainer signs in with the <strong>username and temporary password</strong> you set here; they must choose a new one at first sign-in.</li><li>Assign permissions: <strong>view progress</strong> and <strong>reset passwords</strong>. Both can be changed later.</li><li>Trainers <strong>cannot delete</strong> employee IDs — that stays with you.</li><li>In the playable modules, the assigned trainer introduces the activity and presents system-calculated feedback.</li></ul></section><section class="panel info-panel"><h3>${icon("image")}Picture guidelines</h3><ul class="info-list"><li>Use an image you own or have permission to use.</li><li>Square portraits work best. Uploads are cropped and re-encoded as WebP.</li><li>Image metadata is stripped during processing.</li></ul></section></aside></div>`,
    mount(root) {
      const form = root.querySelector("#trainer-form");
      const input = form.image;
      let previewUrl;
      function preview() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const file = input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          input.value = "";
          formError(form, new Error("The image must be no larger than 5 MB."));
          return;
        }
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          input.value = "";
          formError(form, new Error("Choose a JPG, PNG or WebP image."));
          return;
        }
        previewUrl = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.src = previewUrl;
        img.alt = "Trainer picture preview";
        root.querySelector("#photo-preview").replaceChildren(img);
      }
      input.addEventListener("change", preview);
      const drop = root.querySelector("#photo-drop");
      drop.ondragover = (e) => e.preventDefault();
      drop.ondrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) {
          const transfer = new DataTransfer();
          transfer.items.add(e.dataTransfer.files[0]);
          input.files = transfer.files;
          preview();
        }
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (!trainer && !input.files.length) {
          formError(
            form,
            new Error("Please upload a profile picture for your trainer."),
          );
          return;
        }
        const button = form.querySelector('[type="submit"]');
        busy(button, true, "Saving trainer…");
        try {
          const body = new FormData(form);
          body.delete("moduleKeys");
          body.set(
            "moduleKeys",
            JSON.stringify(
              [...form.querySelectorAll('[name="moduleKeys"]:checked')].map(
                (c) => c.value,
              ),
            ),
          );
          if (!input.files.length) body.delete("image");
          body.set(
            "permissions",
            JSON.stringify({
              viewProgress: form.querySelector('[name="permission-view"]')
                .checked,
              resetPassword: form.querySelector('[name="permission-reset"]')
                .checked,
            }),
          );
          await (trainer
            ? ctx.api.patch(`/admin/trainers/${trainer.id}`, body)
            : ctx.api.post("/admin/trainers", body));
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          notify(
            trainer
              ? "Trainer profile updated."
              : "Your new safety guide is ready.",
          );
          ctx.navigate("/admin/trainers");
        } catch (error) {
          formError(form, error);
        } finally {
          busy(button, false);
        }
      };
      const resetButton = root.querySelector("#trainer-reset-pw");
      if (resetButton)
        resetButton.addEventListener("click", () => {
          modal({
            title: "Reset trainer password",
            subtitle: `New temporary password for ${fullName(trainer)}`,
            content: `<p class="muted small">${trainer.accountUsername ? `Signs in as @${esc(trainer.accountUsername)}.` : ""}The trainer must set a new password at next sign-in. Current sessions are revoked.</p><form id="admin-trainer-reset-form" class="mt-16"><div class="form-alert" hidden></div><div class="field"><label for="temporaryPassword">TEMPORARY PASSWORD</label><input type="password" id="temporaryPassword" name="temporaryPassword" required autocomplete="new-password" placeholder="e.g. SafeSite!2026"></div><div class="field"><label for="confirmPassword">CONFIRM PASSWORD</label><input type="password" id="confirmPassword" name="confirmPassword" required autocomplete="new-password"></div></form>`,
            footer: `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" form="admin-trainer-reset-form" type="submit">${icon("key", 14)}Reset password</button>`,
          });
          const resetForm = document.getElementById("admin-trainer-reset-form");
          resetForm.onsubmit = async (e) => {
            e.preventDefault();
            const button = resetForm.querySelector('[type="submit"]');
            busy(button, true, "Resetting…");
            try {
              await ctx.api.post(
                `/admin/trainers/${trainer.id}/reset-password`,
                Object.fromEntries(new FormData(resetForm)),
              );
              closeModal();
              notify(`Temporary password reset for ${trainer.accountUsername || trainer.nickname}.`);
            } catch (error) {
              formError(resetForm, error);
            } finally {
              busy(button, false);
            }
          };
        });
    },
  };
}
async function applicationsPage(ctx) {
  const data = await ctx.api.get("/admin/applications");
  const all = data.applications || [];
  const trainerApps = all.filter((a) => a.type === "trainer");
  const adminApps = all.filter((a) => a.type === "admin");
  const rows = (app, kind) => {
    const target = app.applicant;
    const scores = (app.scores || []).map((m) => `<td>${m.score === null ? '<span class="muted">—</span>' : `<span style="font-weight:550">${m.score}</span><small class="muted"> /100</small>`}</td>`).join("");
    const extra = kind === "trainer"
      ? scores
      : `<td><span class="badge ${app.trainer?.eligibility?.eligible ? "green" : "amber"}">${app.trainer?.eligibility?.certified ?? 0}/${app.trainer?.eligibility?.minCertified ?? 5} certified · ${app.trainer?.eligibility?.daysActive ?? 0}/${app.trainer?.eligibility?.minDays ?? 90} days</span></td><td class="muted">${esc(app.trainer?.nickname || "—")}</td>`;
    return `<tr><td><div class="person-cell"><div class="person-name">${esc(target?.name || "—")}</div><small class="muted">@${esc(target?.username || "—")}</small></div></td><td><span class="badge ${kind === "trainer" ? "blue" : "amber"}">${kind === "trainer" ? "Trainer application" : "Administrator application"}</span></td>${extra}<td><span class="badge ${app.status === "pending" ? "amber" : app.status === "approved" ? "green" : "red"}">${app.status}</span><small class="muted" style="display:block;font-size:8px">${formatDate(app.createdAt)}</small></td><td>${app.message ? `<span class="muted" style="font-size:10px">“${esc(app.message)}”</span>` : '<span class="muted">—</span>'}</td><td>${app.status === "pending" ? `<button type="button" class="btn btn-primary btn-sm" data-approve="${app.id}">${icon("check", 13)}Approve</button> <button type="button" class="btn btn-secondary btn-sm" data-reject="${app.id}">Decline</button>` : '<span class="muted small">—</span>'}</td></tr>`;
  };
  return {
    title: "Applications",
    html: `${heading("Applications", "Employees and trainers can apply for their next role. Approvals happen here.", null, "PROMOTIONS & ROLES")}<section class="panel"><header class="panel-head"><div><h2>Trainer applications</h2><p>Employees who scored 90+ in all three modules.</p></div>${icon("trainer", 18)}</header><div class="panel-body"><div class="table-scroll"><table class="data-table"><thead><tr><th>Applicant</th><th>Type</th><th>Manual handling</th><th>Working at height</th><th>Hazard perception</th><th>Status</th><th>Message</th><th></th></tr></thead><tbody>${trainerApps.length ? trainerApps.map((a) => rows(a, "trainer")).join("") : '<tr><td colspan="8"><span class="muted">No trainer applications yet.</span></td></tr>'}</tbody></table></div></div></section><section class="panel mt-24"><header class="panel-head"><div><h2>Administrator applications</h2><p>Trainers with the tenure and certification track record.</p></div>${icon("trophy", 18)}</header><div class="panel-body"><div class="table-scroll"><table class="data-table"><thead><tr><th>Applicant</th><th>Type</th><th>Requirements</th><th>Trainer</th><th>Status</th><th>Message</th><th></th></tr></thead><tbody>${adminApps.length ? adminApps.map((a) => rows(a, "admin")).join("") : '<tr><td colspan="7"><span class="muted">No administrator applications yet.</span></td></tr>'}</tbody></table></div></div></section>`,
    mount(root) {
      root.querySelectorAll("[data-approve]").forEach((b) =>
        b.addEventListener("click", async () => {
          const app = all.find((a) => a.id === b.dataset.approve);
          busy(b, true, "Approving…");
          try {
            await ctx.api.post(`/admin/applications/${app.id}/approve`, {});
            notify(`Application approved — ${app.applicant.firstName} ${app.applicant.lastName} has been promoted.`);
            ctx.render();
          } catch (error) {
            notify(error.message, "error");
            busy(b, false);
          }
        }),
      );
      root.querySelectorAll("[data-reject]").forEach((b) =>
        b.addEventListener("click", async () => {
          const app = all.find((a) => a.id === b.dataset.reject);
          busy(b, true, "Declining…");
          try {
            await ctx.api.post(`/admin/applications/${app.id}/reject`, {});
            notify("Application declined.", "info");
            ctx.render();
          } catch (error) {
            notify(error.message, "error");
            busy(b, false);
          }
        }),
      );
    },
  };
}
async function reportsPage(ctx) {
  const data = await ctx.api.get("/admin/trainer-reports");
  const rows = data.reports
    .map(
      (r) => `<tr><td><div class="person-cell"><div class="person-name">${esc(r.employee.name)}</div><small class="muted">@${esc(r.employee.username)}</small></div></td><td>${esc(r.trainer)}</td><td>${r.moduleKey ? `<span class="badge neutral">${moduleMeta[r.moduleKey]?.short || r.moduleKey}</span>` : '<span class="muted">—</span>'}</td><td><span style="font-size:10.5px">${esc(r.message)}</span></td><td class="tiny" style="font-size:9px">${formatDate(r.createdAt)}</td><td><span class="badge ${r.status === "open" ? "amber" : "green"}">${r.status === "open" ? "Open" : "Resolved"}</span>${r.resolvedAt ? `<small class="muted" style="display:block;font-size:8px">${formatDate(r.resolvedAt)}</small>` : ""}</td><td>${r.status === "open" ? `<button type="button" class="btn btn-primary btn-sm" data-resolve="${r.id}">${icon("check", 13)}Mark resolved</button>` : '<span class="muted small">—</span>'}</td></tr>`,
    )
    .join("");
  return {
    title: "Reports",
    html: `${heading("Trainer reports", "Feedback employees send about their guides — helpful, missing, or anything in between.", null, "TRAINER FEEDBACK")}<section class="panel"><header class="panel-head"><div><h2>${data.open} open report${data.open === 1 ? "" : "s"}</h2><p>Resolve a report once you have looked into it. The employee sees the status under Help & resources.</p></div>${icon("alert", 18)}</header><div class="panel-body"><div class="table-scroll"><table class="data-table"><thead><tr><th>Employee</th><th>Trainer</th><th>Module</th><th>Report</th><th>Sent</th><th>Status</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="7"><span class="muted">No trainer reports yet.</span></td></tr>`}</tbody></table></div></div></section>`,
    mount(root) {
      root.querySelectorAll("[data-resolve]").forEach((b) =>
        b.addEventListener("click", async () => {
          busy(b, true, "Resolving…");
          try {
            await ctx.api.post(`/admin/trainer-reports/${b.dataset.resolve}/resolve`, {});
            notify("Report marked as resolved.");
            ctx.render();
          } catch (error) {
            notify(error.message, "error");
            busy(b, false);
          }
        }),
      );
    },
  };
}
function progressTable(employees) {
  return employees.length
    ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Employee</th><th>Manual handling</th><th>Working at height</th><th>Hazard perception</th><th>Overall</th><th>Completed</th><th>Learning status</th></tr></thead><tbody>${employees.map((e) => `<tr><td>${person(e)}</td>${e.progress.modules.map((m) => `<td>${scoreView(m)}<br><span class="cell-percent" title="Module completion">${e.modulePercents?.[m.key] ?? 0}% done</span></td>`).join("")}<td>${e.progress.overallScore === null ? '<span class="muted">—</span>' : `<span style="color:var(--text);font-weight:550">${e.progress.overallScore}</span><small class="muted"> /100</small>`}</td><td><span class="module-percent-bar" title="${e.overallPercent ?? 0}% of all three modules finished"><i style="width:${e.overallPercent ?? 0}%"></i></span><span class="module-percent">${e.overallPercent ?? 0}%</span></td><td>${progressBadge(e.progress.status)}</td></tr>`).join("")}</tbody></table></div>`
    : empty(
        "No matching learning records",
        "Try another name or change the learning status filter.",
        "chart",
      );
}
const MODULE_KEYS_CSV = ["manual-handling", "working-at-height", "hazard-perception"];
function downloadCSV(rows) {
  function cell(value) {
    let text = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  const csv = [
    [
      "Employee ID",
      "First name",
      "Last name",
      "Username",
      "Account status",
      "Manual handling",
      "Working at height",
      "Hazard perception",
      "Overall score",
      "Completed % (all modules)",
      "Manual handling %",
      "Working at height %",
      "Hazard perception %",
      "Modules passed",
      "Certificate eligible",
      "Includes demo scores",
    ],
    ...rows.map((e) => [
      e.employeeNumber,
      e.firstName,
      e.lastName,
      e.username,
      e.status,
      ...e.progress.modules.map((m) => m.score ?? ""),
      e.progress.overallScore ?? "",
      e.overallPercent ?? 0,
      ...MODULE_KEYS_CSV.map((k) => e.modulePercents?.[k] ?? 0),
      e.progress.passed,
      e.progress.eligible ? "Yes" : "No",
      e.progress.hasDemoScores ? "Yes" : "No",
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `zero-incident-progress-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function progressPage(ctx) {
  const data = await ctx.api.get("/admin/progress");
  let rows = data.employees;
  return {
    title: "Learning progress",
    html: `${heading("Every step toward safer work.", "See who’s progressing, who’s ready, and who needs a little support.", `<button class="btn btn-secondary" id="export-progress">${icon("download", 15)}Export CSV</button>`)}<div class="stat-grid">${statCard("Employees", rows.length, "Registered learners", "users")}${statCard("Training complete", rows.filter((e) => e.progress.eligible).length, "All three modules passed", "award", "green-icon")}${statCard("In progress", rows.filter((e) => e.progress.status === "in-progress").length, "Building safer habits", "chart")}${statCard("Need a retake", rows.filter((e) => e.progress.status === "retake").length, "At least one score below 70", "refresh", "amber-icon")}</div>${data.demoMode ? '<div class="scope-note">' + icon("info", 16) + "<span><strong>Demonstration records.</strong> Seeded scores illustrate progress reporting. New employee accounts start with no scores. All three modules now record real assessments. Certificates are issued from verified completion records.</span></div>" : ""}<section class="panel"><div class="table-toolbar"><div class="search-wrap">${icon("search")}<input id="progress-search" type="search" placeholder="Search employees…" aria-label="Search learning progress"></div><select id="progress-filter" aria-label="Filter learning status" style="width:180px;min-height:36px;font-size:10px;padding-top:8px;padding-bottom:8px"><option value="">All learning statuses</option><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="retake">Retake needed</option><option value="complete">Training complete</option></select></div><div id="progress-results">${progressTable(rows)}</div><footer class="table-footer"><span id="progress-count">${rows.length} employees</span><span>Overall score appears after all 3 modules are assessed.</span></footer></section><div class="progress-legend"><span><i></i>Excellent · 85–100</span><span><i class="blue"></i>Pass · 70–84</span><span><i class="amber"></i>Retake · below 70</span><span><i class="gray"></i>Not assessed</span></div>`,
    mount(root) {
      const results = root.querySelector("#progress-results");
      function bind() {
        bindEmployees(results, rows, ctx);
      }
      bind();
      function filter() {
        const q = root
          .querySelector("#progress-search")
          .value.toLowerCase()
          .trim();
        const status = root.querySelector("#progress-filter").value;
        rows = data.employees.filter(
          (e) =>
            (!status || e.progress.status === status) &&
            `${fullName(e)} ${e.username} ${e.employeeNumber}`
              .toLowerCase()
              .includes(q),
        );
        results.innerHTML = progressTable(rows);
        root.querySelector("#progress-count").textContent =
          `${rows.length} employees`;
        bind();
      }
      root.querySelector("#progress-search").oninput = filter;
      root.querySelector("#progress-filter").onchange = filter;
      root.querySelector("#export-progress").onclick = () => {
        downloadCSV(rows);
        notify("Progress report downloaded.");
      };
    },
  };
}
export function settingsPage(ctx) {
  const user = ctx.state.user;
  const admin = user.role === "admin";
  return {
    title: "Account & security",
    html: `${heading("Your account. Your security.", "Keep your account details up to date and your password private.")}<div class="settings-layout"><section class="panel"><header class="panel-head"><div><h2>Profile information</h2><p>${admin ? "Manage your administrator identity." : "Your details are managed by your safety administrator."}</p></div>${icon("user", 17)}</header><div class="panel-body"><div class="settings-profile">${avatar(user, "avatar-lg")}<div><h3>${esc(fullName(user))}</h3><p>${admin ? "Safety Administrator" : `Employee · ${esc(user.employeeNumber)}`}</p></div></div><form id="profile-form" class="settings-form"><div class="form-alert" hidden></div><div class="form-grid mb-24">${inputField("firstName", "FIRST NAME", user.firstName, `maxlength="60" required ${admin ? "" : "readonly"}`)}${inputField("lastName", "LAST NAME", user.lastName, `maxlength="60" required ${admin ? "" : "readonly"}`)}</div>${inputField("username", "USERNAME", user.username, `maxlength="40" required ${admin ? "" : "readonly"}`)}${admin ? `${passwordField("currentPassword", "CURRENT PASSWORD", { id: "profileCurrentPassword", required: false, autocomplete: "current-password", placeholder: "Required only when changing username" })}<p class="small muted" style="font-size:9px;margin:-8px 0 23px">Changing your username requires your current password.</p><button class="btn btn-primary" type="submit">Save profile</button>` : `<div class="form-grid mt-24">${inputField("age", "AGE", user.age, "readonly")}${inputField("employeeNumber", "EMPLOYEE ID", user.employeeNumber, "readonly")}</div><div class="info-callout mt-24">${icon("info", 16)}<span>Contact your administrator if these details need to be updated.</span></div>`}</form></div></section><section class="panel"><header class="panel-head"><div><h2>Change password</h2><p>A strong password keeps your safety journey secure.</p></div>${icon("lock", 17)}</header><div class="panel-body"><form id="change-password-form" class="settings-form"><div class="form-alert" hidden></div><input class="sr-only" type="text" autocomplete="username" aria-label="Account username" value="${esc(user.username)}" readonly>${passwordField("currentPassword", "CURRENT PASSWORD", { autocomplete: "current-password" })}${passwordField("newPassword", "NEW PASSWORD")}${passwordField("confirmPassword", "CONFIRM NEW PASSWORD")}${passwordChecklist()}<div class="info-callout mb-24">${icon("shield", 16)}<span>Changing your password signs you out on every device. You’ll return to the login page.</span></div><button class="btn btn-primary" type="submit">${icon("lock", 14)}Update password</button></form></div></section></div>`,
    mount(root) {
      if (admin)
        root.querySelector("#profile-form").onsubmit = async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const button = form.querySelector('[type="submit"]');
          busy(button, true);
          try {
            const data = await ctx.api.patch(
              "/admin/profile",
              Object.fromEntries(new FormData(form)),
            );
            ctx.state.user = data.user;
            notify("Profile updated.");
            ctx.render();
          } catch (error) {
            formError(form, error);
          } finally {
            busy(button, false);
          }
        };
      root.querySelector("#change-password-form").onsubmit = async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const button = form.querySelector('[type="submit"]');
        busy(button, true, "Updating password…");
        try {
          await ctx.api.post(
            "/auth/change-password",
            Object.fromEntries(new FormData(form)),
          );
          ctx.state.loginUsername = user.username;
          await ctx.refreshSession();
          ctx.navigate("/login");
          notify("Password changed. Sign in again with your new password.");
        } catch (error) {
          formError(form, error);
        } finally {
          busy(button, false);
        }
      };
    },
  };
}
export async function adminPage(route, ctx) {
  if (route === "/admin/certificates") {
    const { adminCertificatesPage } = await import("./certificates.js");
    return adminCertificatesPage(ctx);
  }
  if (/^\/admin\/certificates\/[a-fA-F0-9]{24}$/.test(route)) {
    const { certificatePage } = await import("./certificates.js");
    return certificatePage(ctx, route.split("/")[3]);
  }
  if (route === "/admin/overview") return overview(ctx);
  if (route === "/admin/employees") return employeesPage(ctx);
  if (route === "/admin/employees/new") return employeeForm(ctx);
  if (/^\/admin\/employees\/[^/]+\/edit$/.test(route))
    return employeeForm(ctx, route.split("/")[3]);
  if (route === "/admin/trainers") return trainersPage(ctx);
  if (route === "/admin/trainers/new") return trainerForm(ctx);
  if (/^\/admin\/trainers\/[^/]+\/edit$/.test(route))
    return trainerForm(ctx, route.split("/")[3]);
  if (route === "/admin/progress") return progressPage(ctx);
  if (route === "/admin/applications") return applicationsPage(ctx);
  if (route === "/admin/reports") return reportsPage(ctx);
  if (route === "/admin/settings") return settingsPage(ctx);
  return {
    title: "Page not found",
    html: `${empty("That page isn’t here", "Choose a page from the navigation to continue.", "help")}<div style="text-align:center"><a href="#/admin/overview" class="btn btn-primary">Back to overview</a></div>`,
  };
}
