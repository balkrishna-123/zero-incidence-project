import { icon } from "./icons.js";
import {
  esc,
  fullName,
  notify,
  modal,
  closeModal,
  busy,
  formError,
  empty,
  formatDate,
  moduleMeta,
} from "./ui.js";

function permissionRow(label, granted, hint) {
  return `<div class="detail-module"><span class="module-small-icon">${icon(granted ? "checkCircle" : "lock")}</span><div><strong>${label}</strong><small>${granted ? hint : "Not enabled by your administrator"}</small></div><span class="badge ${granted ? "green" : "gray"}">${granted ? "Enabled" : "Off"}</span></div>`;
}
async function overview(ctx) {
  const data = await ctx.api.get("/trainer/me");
  const t = data.trainer;
  const canView = t.permissions.viewProgress;
  const canReset = t.permissions.resetPassword;
    return {
    title: "Overview",
    html: `<div class="page-heading"><div><h1>Welcome back, ${esc(t.nickname)}.</h1><p>Your trainer workspace — learner progress you can see, and your path to the next role.</p></div></div>
    <div class="overview-grid">
      <section class="panel"><header class="panel-head"><div><h2>Your permissions</h2><p>Assigned by your administrator.</p></div>${icon("lock", 18)}</header><div class="panel-body">
        ${permissionRow("View employee progress", canView, "See every learner's module scores")}
        ${permissionRow("Reset employee passwords", canReset, "Issue a new temporary password")}
        <div class="info-callout mt-24">${icon("shield", 17)}<span>Trainers can <strong>never delete</strong> employee IDs — that stays with the administrator.</span></div>
      </div></section>
      <section class="panel"><header class="panel-head"><div><h2>Promotion progress</h2><p>Your path to the administrator role.</p></div>${icon("trophy", 18)}</header><div class="panel-body">
        <div class="rating-stats"><div><strong>${data.adminEligibility.daysActive}</strong><small>active days (of ${data.adminEligibility.minDays})</small></div><div><strong>${data.adminEligibility.certified}</strong><small>employees certified (of ${data.adminEligibility.minCertified})</small></div><div><strong>${data.adminEligibility.eligible ? "Yes" : "Not yet"}</strong><small>eligible to apply</small></div></div>
        <div class="progress-bar"><i style="width:${Math.min(100, Math.round((data.adminEligibility.daysActive / data.adminEligibility.minDays) * 100))}%"></i></div>
        <div class="progress-bar"><i style="width:${Math.min(100, Math.round((data.adminEligibility.certified / data.adminEligibility.minCertified) * 100))}%"></i></div>
        <p class="small muted">Tenure as an active trainer plus employees certified under your guidance replace the old star ratings.</p>
        <a class="btn btn-secondary btn-sm" href="#/trainer/promotion">${icon("trophy", 13)}Promotion details</a>
      </div></section>
    </div>
    <section class="panel"><header class="panel-head"><div><h2>Quick actions</h2><p>Jump back into the work.</p></div>${icon("grid", 18)}</header><div class="panel-body"><div class="setup-list">
      <a class="setup-item" href="#/trainer/employees" ${canView ? "" : "aria-disabled=true"}><span class="setup-icon">${icon("users", 15)}</span><div><strong>Employee progress</strong><p>${canView ? "Module scores and overall status for every learner." : "Permission not enabled by your administrator yet."}</p></div>${icon("chevron")}</a>
      <a class="setup-item" href="#/trainer/promotion"><span class="setup-icon">${icon("trophy", 15)}</span><div><strong>Promotion</strong><p>Your administrator-track progress and application.</p></div>${icon("chevron")}</a>
    </div></div></section>`,
    mount() {},
  };
}
async function employees(ctx) {
  const me = await ctx.api.get("/trainer/me");
  const canView = me.trainer.permissions.viewProgress;
  const canReset = me.trainer.permissions.resetPassword;
  if (!canView)
    return {
      title: "Employee progress",
      html: `${headingBlock()}<section class="panel"><div class="panel-body">${empty("Progress viewing is off", "Your administrator has not enabled the “view employee progress” permission for your trainer account. Ask them to switch it on in the trainer settings.", "lock")}</div></section>`,
      mount() {},
    };
  const data = await ctx.api.get("/trainer/employees");
  const canResetAny = canReset;
  return {
    title: "Employee progress",
    html: `${headingBlock()}<section class="panel"><header class="panel-head"><div><h2>${data.employees.length} learner${data.employees.length === 1 ? "" : "s"}</h2><p>Everyone trains toward 70/100 in each module; 90+ in all three unlocks a trainer application.</p></div>${icon("chart", 18)}</header><div class="panel-body"><div class="table-scroll"><table class="data-table"><thead><tr><th>Employee</th><th>Role</th><th>Manual handling</th><th>Working at height</th><th>Hazard perception</th><th>Overall</th><th>Completed</th><th>Status</th>${canResetAny ? "<th></th>" : ""}</tr></thead><tbody>${data.employees
      .map(
        (e) =>
          `<tr><td><div class="person-cell"><div class="person-name">${esc(fullName(e))}</div><small class="muted">@${esc(e.username)}${e.employeeNumber ? ` · ${esc(e.employeeNumber)}` : ""}</small></div></td><td>${e.role === "trainer" ? '<span class="badge neutral">Trainer</span>' : '<span class="badge gray">Employee</span>'}</td>${e.progress.modules
            .map(
              (m) =>
                `<td>${m.score === null ? '<span class="muted">—</span>' : `<span style="font-weight:550">${m.score}</span><small class="muted"> /100</small>`}<br><span class="cell-percent" title="Module completion">${e.modulePercents?.[m.key] ?? 0}% done</span></td>`,
            )
            .join("")}<td>${e.progress.overallScore === null ? '<span class="muted">—</span>' : `<span style="font-weight:550">${e.progress.overallScore}</span><small class="muted"> /100</small>`}</td><td><span class="module-percent-bar" title="${e.overallPercent ?? 0}% of all three modules finished"><i style="width:${e.overallPercent ?? 0}%"></i></span><span class="module-percent">${e.overallPercent ?? 0}%</span></td><td>${progressCell(e)}</td>${canResetAny ? `<td><button type="button" class="btn btn-secondary btn-sm" data-reset="${e.id}" title="Reset password for ${esc(fullName(e))}">${icon("key", 13)}Reset password</button></td>` : ""}</tr>`,
      )
      .join("")}</tbody></table></div></div></section>`,
    mount(root) {
      if (!canResetAny) return;
      root.querySelectorAll("[data-reset]").forEach((button) => {
        button.addEventListener("click", () => {
          const employee = data.employees.find((e) => e.id === button.dataset.reset);
          openResetModal(ctx, employee);
        });
      });
    },
  };
}
function headingBlock() {
  return `<div class="page-heading"><div><h1>Employee progress</h1><p>Follow every learner's safety journey across the three modules.</p></div></div>`;
}
function progressCell(e) {
  const p = e.progress;
  const map = {
    complete: ["green", "Complete"],
    "in-progress": ["blue", "In progress"],
    retake: ["amber", "Retake needed"],
    "not-started": ["gray", "Not started"],
  };
  const [cls, label] = map[p.status] || ["gray", p.status];
  return `<span class="badge ${cls}">${label}</span>`;
}
function openResetModal(ctx, employee) {
  modal({
    title: `Reset password`,
    subtitle: `New temporary password for ${fullName(employee)}`,
    content: `<p class="muted small">The employee must set their own new password at next sign-in. Their current sessions are revoked.</p><form id="trainer-reset-form" class="mt-16"><div class="form-alert" hidden></div><div class="field"><label for="temporaryPassword">TEMPORARY PASSWORD</label><input type="password" id="temporaryPassword" name="temporaryPassword" required autocomplete="new-password" placeholder="e.g. SafeSite!2026"></div><div class="field"><label for="confirmPassword">CONFIRM PASSWORD</label><input type="password" id="confirmPassword" name="confirmPassword" required autocomplete="new-password"></div></form>`,
    footer: `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" form="trainer-reset-form" type="submit">${icon("key", 14)}Reset password</button>`,
  });
  const form = document.getElementById("trainer-reset-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    busy(button, true, "Resetting…");
    try {
      await ctx.api.post(`/trainer/employees/${employee.id}/reset-password`, Object.fromEntries(new FormData(form)));
      closeModal();
      notify(`Temporary password reset for ${employee.username}.`);
    } catch (error) {
      formError(form, error);
    } finally {
      busy(button, false);
    }
  };
}
async function promotion(ctx) {
  const data = await ctx.api.get("/trainer/me");
  const t = data.trainer;
  const eligibility = data.adminEligibility;
  const application = data.adminApplication;
  const daysPct = Math.min(100, Math.round((eligibility.daysActive / eligibility.minDays) * 100));
  const certPct = Math.min(100, Math.round((eligibility.certified / eligibility.minCertified) * 100));
  let promotion;
  if (application?.status === "pending")
    promotion = `<div class="info-callout blue-callout">${icon("clock", 17)}<span><strong>Application under review.</strong><br>You applied on ${formatDate(application.createdAt)}. Your administrator will approve or decline it.</span></div>`;
  else if (application?.status === "rejected")
    promotion = `<div class="info-callout red-callout">${icon("alert", 17)}<span><strong>Application declined.</strong> You can apply again once the requirements below are met. ${application.message ? `Your last note: “${esc(application.message)}”` : ""}</span></div>`;
  else if (data.canApplyAdmin)
    promotion = `<div class="info-callout green-callout">${icon("trophy", 17)}<span><strong>You meet the administrator requirements.</strong> Apply below — the current administrator approves your application, so the team would then have two administrators.</span></div><form id="admin-apply-form" class="mt-16"><div class="form-alert" hidden></div><div class="field"><label for="message">WHY YOU'RE READY (optional)</label><textarea id="message" name="message" rows="3" maxlength="600" placeholder="A short note for your administrator…"></textarea></div></form>`;
  else
    promotion = `<div class="info-callout">${icon("trophy", 17)}<span><strong>Keep building your track record.</strong> Meet both requirements below to apply for an administrator position — the current administrator approves every application.</span></div>`;
  return {
    title: "Promotion",
    html: `<div class="page-heading"><div><h1>Promotion</h1><p>Your path from trainer to administrator — measured by tenure and the employees you guide to certification.</p></div></div>
    <section class="panel"><header class="panel-head"><div><h2>Administrator requirements</h2><p>Both conditions must be met before you can apply.</p></div>${icon("trophy", 18)}</header><div class="panel-body">
      <div class="detail-module"><span class="module-small-icon">${icon("clock")}</span><div><strong>${eligibility.minDays} active days as a trainer</strong><small>You are on day ${eligibility.daysActive}${eligibility.active ? "" : " (your trainer profile is currently inactive)"}</small><span class="module-percent-bar"><i style="width:${daysPct}%"></i></span></div><span class="module-percent">${daysPct}%</span><span style="margin-left:auto" class="badge ${eligibility.daysActive >= eligibility.minDays ? "green" : "amber"}">${eligibility.daysActive >= eligibility.minDays ? "Met" : "In progress"}</span></div>
      <div class="detail-module"><span class="module-small-icon">${icon("award")}</span><div><strong>${eligibility.minCertified} employees certified under your guidance</strong><small>${eligibility.certified} employee${eligibility.certified === 1 ? "" : "s"} certified so far — an employee counts once they pass all three modules, including one you guide</small><span class="module-percent-bar"><i style="width:${certPct}%"></i></span></div><span class="module-percent">${certPct}%</span><span style="margin-left:auto" class="badge ${eligibility.certified >= eligibility.minCertified ? "green" : "amber"}">${eligibility.certified >= eligibility.minCertified ? "Met" : "In progress"}</span></div>
      <div class="info-callout mt-24">${icon("info", 17)}<span>Star ratings were retired in the October 2026 revision. Promotion now follows the same pattern as employee → trainer: meet the objective conditions, then the administrator decides.</span></div>
    </div></section>
    <section class="panel mt-24"><header class="panel-head"><div><h2>Apply for an administrator position</h2><p>Approved by the current administrator.</p></div>${icon("send", 18)}</header><div class="panel-body">${promotion}${application?.status === "approved" ? '<div class="info-callout green-callout mt-24">' + icon("checkCircle", 17) + "<span><strong>Approved.</strong> You now hold an administrator position.</span></div>" : ""}${data.canApplyAdmin && !application ? '<div class="form-actions mt-16"><button class="btn btn-primary" form="admin-apply-form" type="submit">' + icon("send", 15) + 'Send application</button></div>' : ""}</div></section>`,
    mount(root) {
      const form = root.querySelector("#admin-apply-form");
      if (!form) return;
      form.onsubmit = async (e) => {
        e.preventDefault();
        const button = form.querySelector('[type="submit"]');
        busy(button, true, "Sending…");
        try {
          await ctx.api.post("/trainer/apply-admin", { message: form.message.value });
          notify("Application sent to your administrator.");
          ctx.render();
        } catch (error) {
          formError(form, error);
        } finally {
          busy(button, false);
        }
      };
    },
  };
}
export async function trainerPage(route, ctx) {
  if (route === "/trainer/overview") return overview(ctx);
  if (route === "/trainer/employees") return employees(ctx);
  if (route === "/trainer/promotion" || route === "/trainer/ratings") return promotion(ctx);
  return {
    title: "Page not found",
    html: `${empty("That page isn’t here", "Choose a page from the navigation to continue.", "help")}<div style="text-align:center"><a class="btn btn-primary" href="#/trainer/overview">Back to trainer overview</a></div>`,
  };
}
