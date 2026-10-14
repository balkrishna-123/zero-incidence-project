import { icon } from "./icons.js";
import { esc, moduleMeta, avatar, notify, copy } from "./ui.js";
import { downloadFile } from "./api.js";

const score = (value) =>
  value === null || value === undefined ? "—" : `${value}`;
const overall = (value) =>
  value === null || value === undefined ? "—" : Number(value).toFixed(1);
const statusLabel = (s) =>
  s.status === "issued"
    ? "Certificate issued"
    : s.status === "review"
      ? "Record needs review"
      : s.eligible
        ? "All three modules passed"
        : "Training in progress";
const stateBadge = (s) =>
  `<span class="badge ${s.status === "issued" || s.eligible ? "green" : s.status === "review" ? "amber" : "gray"}">${icon(s.status === "issued" ? "award" : s.eligible ? "checkCircle" : "lock", 12)}${statusLabel(s)}</span>`;

function paper(record, preview = false) {
  return `<article class="certificate-paper ${preview ? "is-preview" : ""}" aria-label="${preview ? "Unissued certificate preview" : "Issued certificate preview"}" data-certificate-paper>
    <div class="certificate-paper-top"><div class="certificate-wordmark">${icon("shield", 29)}<span><strong>ZERO <b>INCIDENT</b></strong><small>SAFETY LEARNING</small></span></div><span>${record.demoLearner ? "DEMO LEARNER RECORD" : "DIGITAL LEARNING RECORD"}</span></div>
    <div class="certificate-paper-title"><h2>Certificate of Completion</h2><p>${esc(record.programTitle)}</p></div>
    <p class="certificate-presented">This certifies that</p><h3 class="certificate-recipient">${esc(record.employeeName)}</h3>
    <p class="certificate-identity">${esc(record.identifierLabel)}: ${esc(record.employeeIdentifier)}</p>
    <p class="certificate-achievement">has completed and passed all three Zero Incident learning modules.</p>
    <div class="certificate-marks"><div><div class="certificate-marks-heading"><span>REQUIRED MODULE</span><span>SCORE</span><span>RESULT</span></div>${record.modules.map((m) => `<div class="certificate-mark-row"><span>${esc(m.title)}</span><strong>${m.score}/100</strong><span>${m.score >= 85 ? "Excellent" : "Pass"}</span></div>`).join("")}</div><div class="certificate-seal"><strong>3/3</strong><span>MODULES PASSED</span></div></div>
    <p class="certificate-average">Overall score: <strong>${overall(record.overallScore)}/100</strong> · Every module passed at 70 or above</p>
    <div class="certificate-dates"><div><span>COMPLETED</span><strong>${esc(record.completionDate)}</strong></div><div><span>ISSUED</span><strong>${preview ? "When generated" : esc(record.issueDate)}</strong></div><div><span>ISSUED BY</span><strong>Zero Incident</strong></div></div>
    <div class="certificate-reference"><span>${preview ? "PREVIEW · NOT YET ISSUED" : esc(record.certificateId)}</span></div>
    <p class="certificate-paper-notice">A digital learning completion record, not practical competence certification, a licence or authorisation to perform hazardous work. Follow workplace training and assessed procedures.</p>
  </article>`;
}
function resultsTable(s, admin) {
  return `<section class="panel completion-results"><header class="panel-head"><div><h2>Current verified learning results</h2><p>Best complete journeys — the average of all twenty-four question scores — checked against their recorded responses. Sample scores do not count.</p></div>${icon("chart", 19)}</header><div class="table-scroll"><table class="completion-table"><thead><tr><th>Module</th><th>Final result</th><th>Assessed journeys</th><th>Assessment status</th>${admin ? "" : "<th>Continue</th>"}</tr></thead><tbody>${s.modules.map((m) => `<tr><td><span class="completion-module-name">${icon(moduleMeta[m.key].icon, 18)}${esc(m.title)}</span></td><td><strong>${score(m.score)}</strong><small>/100 · avg of 24</small></td><td>${m.attempts ?? 0}<small> completed</small></td><td><span class="badge ${m.passed ? "green" : m.verified ? "amber" : "gray"}">${m.passed ? "Verified pass" : m.verified ? "Retake required" : "Not verified"}</span><small class="completion-reason">${m.passed ? "Best completed assessment" : esc(m.reason)}</small></td>${admin ? "" : `<td><a class="btn btn-secondary btn-sm" href="#/employee/module/${m.key}${m.activeAttemptId ? `?attempt=${encodeURIComponent(m.activeAttemptId)}` : m.passed ? `?attempt=${encodeURIComponent(m.attemptId)}` : ""}">${m.activeAttemptId ? "Resume" : m.passed ? "Review" : m.verified ? "Retake" : "Start"}</a></td>`}</tr>`).join("")}</tbody></table></div><footer class="completion-results-foot"><span>${s.passed}/3 modules have a verified passing assessment</span><strong>Current overall: ${overall(s.overallScore)}/100</strong></footer></section>`;
}
export async function certificatePage(ctx, employeeId = null) {
  const admin = Boolean(employeeId);
  const endpoint = admin
    ? `/admin/employees/${encodeURIComponent(employeeId)}/certificate`
    : "/me/certificate";
  const s = await ctx.api.get(endpoint);
  const issued = s.certificate && s.certificate.valid;
  const display = issued
    ? s.certificate
    : {
        ...s,
        demoLearner: s.demoLearner,
        issueDate: "",
        certificateId: "",
        modules: s.modules,
      };
  const paperReady = issued || (!s.certificate && s.eligible);
  return {
    title: admin ? "Completion record" : "Completion & certificate",
    html: `<div class="cert-page" data-cert-page>
      ${admin ? '<a class="training-back" href="#/admin/certificates">← Back to completion records</a>' : ""}
      <header class="page-heading"><div><div class="page-eyebrow">YOUR SAFETY MILESTONE</div><h1>${admin ? esc(s.employeeName) : s.eligible || issued ? "Every module passed. A milestone earned." : "Every safe step leads here."}</h1><p>${admin ? "Verified learning evidence and the employee’s certificate record." : "Your final summary and downloadable completion certificate."}</p></div>${stateBadge(s)}</header>
      <div class="completion-progress-cards">${s.modules.map((m) => `<div class="panel completion-progress-card"><span class="module-icon ${moduleMeta[m.key].color}">${icon(moduleMeta[m.key].icon, 20)}</span><div><strong>${esc(m.title)}</strong><small>${m.passed ? "Verified pass" : m.verified ? "Retake required" : "Genuine assessment needed"}</small></div><span class="completion-check ${m.passed ? "passed" : ""}">${icon(m.passed ? "checkCircle" : "lock", 20)}</span></div>`).join("")}</div>
      <div class="certificate-error" role="alert" hidden data-certificate-error></div>
      <div class="certificate-layout"><section class="certificate-display">${paperReady ? paper(display, !issued) : `<div class="panel certificate-locked"><span class="certificate-locked-icon">${icon(s.status === "review" ? "alert" : "award", 43)}</span><span class="badge ${s.status === "review" ? "amber" : "gray"}">${s.status === "review" ? "INTEGRITY CHECK" : "CERTIFICATE LOCKED"}</span><h2>${s.status === "review" ? "This record needs a review." : "Your certificate is ahead of you."}</h2><p>${s.status === "review" ? "The issued record or its linked evidence could not be verified. Contact your administrator. No replacement or PDF is generated automatically." : "Pass Manual Handling, Working at Height and Hazard Perception with at least 70/100 in each genuine assessment. A high average cannot compensate for a failed module."}</p><div class="progress-ring" style="--value:${s.percent}"><span>${s.passed}/3</span></div><p class="cert-lock-note">Sample scores and unverified summary records never unlock a certificate.</p></div>`}</section>
      <aside class="panel certificate-actions"><span class="certificate-action-icon">${icon(issued ? "award" : s.eligible ? "checkCircle" : "shield", 23)}</span><div class="page-eyebrow">${issued ? "COMPLETION RECORDED" : s.eligible ? "READY TO GENERATE" : "BUILD YOUR SAFER START"}</div><h2>${issued ? "Your certificate is ready." : s.status === "review" ? "Contact your administrator." : s.eligible ? "All three. Individually passed." : `${s.passed} of 3 modules passed.`}</h2><p>${issued ? "Download a PDF copy of this issued completion record. The original name, scores and dates are kept on future downloads." : s.eligible ? "Check the recipient name and identifier in the preview. Generating creates one permanent snapshot of the best verified marks shown here." : "Continue the modules below. Only complete, server-verified assessments count toward this milestone."}</p>
      <dl class="certificate-facts"><div><dt>Recipient</dt><dd>${esc(issued ? s.certificate.employeeName : s.employeeName)}</dd></div><div><dt>Modules passed</dt><dd>${issued ? "3" : s.passed} / 3</dd></div><div><dt>${issued ? "Overall at issue" : "Current overall"}</dt><dd>${overall(issued ? s.certificate.overallScore : s.overallScore)} / 100</dd></div>${issued ? `<div><dt>Issue date</dt><dd>${esc(s.certificate.issueDate)}</dd></div>` : ""}</dl>
      ${s.canIssue ? `<button class="btn btn-primary certificate-primary" data-issue-certificate>${icon("award", 16)}Generate ${admin ? "certificate" : "my certificate"}</button>` : issued ? `<button class="btn btn-primary certificate-primary" data-download-certificate>${icon("download", 16)}Download PDF</button><div class="certificate-id-box"><small>CERTIFICATE ID</small><code>${esc(s.certificate.certificateId)}</code><button type="button" data-copy-certificate>${icon("copy", 13)}Copy ID</button></div>` : !s.accountReady && admin ? '<div class="info-callout">The account must be active and password setup complete before issuance.</div>' : ""}
      <button class="btn btn-secondary certificate-primary" data-refresh-certificate>${icon("refresh", 14)}Refresh status</button>
      ${admin ? `<a class="certificate-secondary-link" href="#/admin/employees/${encodeURIComponent(employeeId)}/edit">View employee account ${icon("arrow", 12)}</a>` : '<a class="certificate-secondary-link" href="#/employee/hub">Back to training hub →</a>'}
      ${s.snapshotDiffers ? '<div class="certificate-snapshot-note">The current profile or best scores differ from the issued snapshot. The certificate intentionally keeps its original details.</div>' : ""}
      <p class="certificate-footnote">This recognises completion of the Zero Incident learning simulation. It does not authorise hazardous work or replace workplace instruction.</p></aside></div>
      ${resultsTable(s, admin)}
    </div>`,
    mount(root) {
      const el = root.querySelector("[data-cert-page]");
      let alive = true,
        pending = false;
      const error = (message) => {
        if (alive) {
          el.querySelector("[data-certificate-error]").textContent = message;
          el.querySelector("[data-certificate-error]").hidden = false;
        }
      };
      const operation = async (button, label, fn) => {
        if (pending) return;
        pending = true;
        const html = button.innerHTML;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = label;
        el.querySelector("[data-certificate-error]").hidden = true;
        try {
          await fn();
        } catch (e) {
          error(e.message);
        } finally {
          pending = false;
          if (alive) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.innerHTML = html;
          }
        }
      };
      el.querySelector("[data-issue-certificate]")?.addEventListener(
        "click",
        (e) =>
          operation(e.currentTarget, "Generating…", async () => {
            await ctx.api.post(endpoint, {
              recipientId: s.employeeId,
              reviewKey: s.reviewKey,
            });
            if (!alive) return;
            notify(
              "Completion certificate generated. Your record has been saved.",
            );
            await ctx.render();
          }),
      );
      el.querySelector("[data-download-certificate]")?.addEventListener(
        "click",
        (e) =>
          operation(e.currentTarget, "Preparing PDF…", () =>
            downloadFile(
              `${endpoint}/pdf?certificateId=${encodeURIComponent(s.certificate.certificateId)}`,
              `Zero-Incident-${s.certificate.certificateId}.pdf`,
            ),
          ),
      );
      el.querySelector("[data-copy-certificate]")?.addEventListener(
        "click",
        () => copy(s.certificate.certificateId),
      );
      el.querySelector("[data-refresh-certificate]").addEventListener(
        "click",
        (e) =>
          operation(e.currentTarget, "Refreshing…", async () => {
            await ctx.refreshSession();
            if (alive) await ctx.render();
          }),
      );
      return () => {
        alive = false;
      };
    },
  };
}
export async function adminCertificatesPage(ctx) {
  const data = await ctx.api.get("/admin/certificates");
  const records = data.records;
  return {
    title: "Completion records",
    html: `<div class="cert-admin" data-cert-admin><header class="page-heading"><div><div class="page-eyebrow">VERIFIED LEARNING RECORDS</div><h1>A milestone, backed by evidence.</h1><p>Review genuine completion, issue certificates and download saved records.</p></div><button class="btn btn-secondary" data-records-refresh>${icon("refresh", 15)}Refresh records</button></header><div class="stat-grid"><div class="stat-card"><div class="stat-label">Employees</div><div class="stat-number">${records.length}</div><div class="stat-note">Registered learners</div></div><div class="stat-card"><div class="stat-label">Certificates issued</div><div class="stat-number">${records.filter((r) => r.completion.status === "issued").length}</div><div class="stat-note">Evidence-checked records</div></div><div class="stat-card"><div class="stat-label">Ready to generate</div><div class="stat-number">${records.filter((r) => r.completion.canIssue).length}</div><div class="stat-note">Active, verified completion</div></div><div class="stat-card"><div class="stat-label">Needs review</div><div class="stat-number">${records.filter((r) => r.completion.status === "review").length}</div><div class="stat-note">Issued evidence checks</div></div></div><div class="scope-note">${icon("shield", 17)}<span>Only genuine completed attempts qualify. Sample progress never creates a certificate. Issued records keep the name and best marks captured at issue.</span></div><section class="panel"><div class="table-toolbar"><div class="search-wrap">${icon("search", 17)}<input type="search" id="certificate-search" aria-label="Search completion records" placeholder="Search name, employee ID or certificate ID…"></div><select id="certificate-filter" aria-label="Filter completion records"><option value="">All records</option><option value="issued">Issued</option><option value="ready">Ready to generate</option><option value="locked">Training required</option><option value="review">Needs review</option></select></div><div class="table-scroll"><table class="data-table completion-admin-table"><thead><tr><th>Employee</th><th>Verified passes</th><th>Current overall</th><th>Certificate record</th><th>Actions</th></tr></thead><tbody data-certificate-rows></tbody></table></div><footer class="table-footer"><span data-certificate-count></span><div class="certificate-pagination"><button class="btn btn-secondary btn-sm" data-records-prev>Previous</button><button class="btn btn-secondary btn-sm" data-records-next>Next</button></div></footer></section></div>`,
    mount(root) {
      const el = root.querySelector("[data-cert-admin]");
      let page = 1,
        downloading = false,
        alive = true;
      const render = () => {
        const query = el
          .querySelector("#certificate-search")
          .value.trim()
          .toLowerCase();
        const filter = el.querySelector("#certificate-filter").value;
        const filtered = records.filter((r) => {
          const searchable = [
            r.employee.firstName,
            r.employee.lastName,
            r.employee.username,
            r.employee.employeeNumber,
            r.completion.certificate?.employeeName,
            r.completion.certificate?.certificateId,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return (
            searchable.includes(query) &&
            (!filter ||
              (filter === "ready"
                ? r.completion.canIssue
                : r.completion.status === filter))
          );
        });
        const pages = Math.max(1, Math.ceil(filtered.length / 10));
        page = Math.min(page, pages);
        el.querySelector("[data-certificate-rows]").innerHTML =
          filtered
            .slice((page - 1) * 10, page * 10)
            .map(
              ({ employee: e, completion: c }) =>
                `<tr><td><div class="person">${avatar(e)}<span><strong>${esc(`${e.firstName} ${e.lastName}`)}</strong><small>${esc(e.employeeNumber || e.username)}${e.status === "inactive" ? " · Inactive" : ""}</small></span></div></td><td>${c.passed} / 3</td><td><strong>${overall(c.overallScore)}</strong><small>/100</small></td><td>${stateBadge(c)}${c.certificate ? `<small class="cert-table-id">${esc(c.certificate.certificateId)}</small>` : ""}</td><td><div class="certificate-row-actions"><a class="btn btn-secondary btn-sm" href="#/admin/certificates/${e.id}">View record</a>${c.certificate?.valid ? `<button class="icon-button" aria-label="Download certificate for ${esc(`${e.firstName} ${e.lastName}`)}" data-admin-pdf="${e.id}">${icon("download", 16)}</button>` : ""}</div></td></tr>`,
            )
            .join("") ||
          '<tr><td colspan="5"><div class="cert-table-empty">No matching completion records.</div></td></tr>';
        el.querySelector("[data-certificate-count]").textContent =
          `${filtered.length} employees · Page ${page} of ${pages}`;
        el.querySelector("[data-records-prev]").disabled = page <= 1;
        el.querySelector("[data-records-next]").disabled = page >= pages;
      };
      el.querySelector("#certificate-search").oninput = () => {
        page = 1;
        render();
      };
      el.querySelector("#certificate-filter").onchange = () => {
        page = 1;
        render();
      };
      el.querySelector("[data-records-prev]").onclick = () => {
        page--;
        render();
      };
      el.querySelector("[data-records-next]").onclick = () => {
        page++;
        render();
      };
      el.querySelector("[data-records-refresh]").onclick = () => ctx.render();
      const click = async (event) => {
        const button = event.target.closest("[data-admin-pdf]");
        if (!button || downloading) return;
        const r = records.find(
          (r) => r.employee.id === button.dataset.adminPdf,
        );
        if (!r?.completion.certificate?.valid) return;
        downloading = true;
        button.disabled = true;
        try {
          const id = r.completion.certificate.certificateId;
          await downloadFile(
            `/admin/employees/${r.employee.id}/certificate/pdf?certificateId=${encodeURIComponent(id)}`,
            `Zero-Incident-${id}.pdf`,
          );
        } catch (e) {
          if (alive) notify(e.message, "error");
        } finally {
          downloading = false;
          if (alive) button.disabled = false;
        }
      };
      el.addEventListener("click", click);
      render();
      return () => {
        alive = false;
        el.removeEventListener("click", click);
      };
    },
  };
}
