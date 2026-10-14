import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const temp = await mkdtemp(path.join(os.tmpdir(), "zi-certificate-browser-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "true";
process.env.DATA_DIR = temp;
process.env.SESSION_SECRET = "certificate-browser-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");
const { seedDatabase } = await import("../server/seed.js");
const { User } = await import("../server/models.js");
const { Certificate } = await import("../server/certificate-model.js");
const { hashPassword } = await import("../server/passwords.js");
const { finishModule } = await import("./certificate-fixtures.mjs");
const uri = await connectDatabase({ isolated: true });
await seedDatabase();
const hash = await hashPassword("Certificate!2026");
const first = await User.create({
  firstName: "Lina",
  lastName: "Thapa",
  age: 25,
  username: "certificate.learner",
  employeeNumber: "ZI-2026-2101",
  role: "employee",
  passwordHash: hash,
  mustChangePassword: false,
});
const second = await User.create({
  firstName: "Bimal",
  lastName: "Karki",
  age: 27,
  username: "certificate.second",
  employeeNumber: "ZI-2026-2102",
  role: "employee",
  passwordHash: hash,
  mustChangePassword: false,
});
const app = await createApp(uri),
  server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const pages = [],
  errors = [];
const artifacts = path.resolve("data/certificate-artifacts");
await mkdir(artifacts, { recursive: true });
async function page() {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  pages.push(p);
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
async function login(p, user, password = "Certificate!2026") {
  await p.goto(base);
  await p.locator("#username").fill(user);
  await p.locator("#password").fill(password);
  await p.locator(".login-submit").click();
  // Employees land on the standalone 360° lobby; admins on the workspace.
  await expect(p.locator(".workspace, .game-hub")).toBeVisible();
}
// The lobby and the workspace reach Certificates through different chrome,
// so navigate by hash from wherever the session currently is.
async function openCertificates(p) {
  await p.evaluate(() => { location.hash = "#/employee/certificates"; });
  await expect(p.locator(".certificate-display")).toBeVisible({
    timeout: 15000,
  });
}
async function assess(p, key, opts) {
  const csrf = (await (await p.request.get(base + "/api/session")).json())
    .csrfToken;
  return finishModule(
    async (u) => {
      const r = await p.request.get(base + "/api" + u);
      assert.equal(r.status(), 200);
      return r.json();
    },
    async (u, b) => {
      const r = await p.request.post(base + "/api" + u, {
        headers: { "X-CSRF-Token": csrf },
        data: b,
      });
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    },
    key,
    opts,
  );
}
async function noOverflow(p) {
  const v = await p.evaluate(() => [
    innerWidth,
    document.documentElement.scrollWidth,
  ]);
  assert.ok(v[1] <= v[0] + 1, v.join(" / "));
}
try {
  const demo = await page();
  await login(demo, "anisha.g", "DemoOnly!2026");
  await openCertificates(demo);
  await expect(demo.locator(".certificate-locked")).toBeVisible();
  await expect(demo.locator("[data-issue-certificate]")).toHaveCount(0);
  await expect(
    demo.locator(".certificate-locked .progress-ring"),
  ).toContainText("0/3");
  await noOverflow(demo);
  await demo.screenshot({
    path: path.join(artifacts, "certificate-locked.png"),
    fullPage: true,
    animations: "disabled",
  });
  const learner = await page();
  await login(learner, "certificate.learner");
  await assess(learner, "manual-handling");
  await assess(learner, "working-at-height");
  // Journey scoring: each of the 24 questions starts at 100 with 25 off per
  // wrong attempt. This pattern (8×75 + 8×50 + 8×75) lands the module at
  // 1600/24 = 66.7 — below the 70 pass line.
  await assess(learner, "hazard-perception", {
    wrongs: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2, 2, 2, 2],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
  });
  await openCertificates(learner);
  await expect(
    learner.locator(".certificate-locked .progress-ring"),
  ).toContainText("2/3");
  await expect(learner.locator("[data-issue-certificate]")).toHaveCount(0);
  // Overall = average of the three verified module scores (100, 100, 66.7).
  await expect(learner.locator(".completion-results-foot")).toContainText(
    "88.9",
  );
  // Retake: four wrong attempts → 2300/24 = 95.8, a pass.
  await assess(learner, "hazard-perception", {
    wrongs: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  });
  await learner.locator("[data-refresh-certificate]").click();
  await expect(learner.locator(".certificate-paper.is-preview")).toBeVisible();
  await expect(learner.locator("[data-issue-certificate]")).toBeEnabled();
  await expect(learner.locator(".certificate-recipient")).toHaveText(
    "Lina Thapa",
  );
  await learner.screenshot({
    path: path.join(artifacts, "certificate-ready.png"),
    fullPage: true,
    animations: "disabled",
  });
  let posts = 0;
  learner.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/me/certificate"))
      posts++;
  });
  await learner.locator("[data-issue-certificate]").evaluate((b) => {
    b.click();
    b.click();
  });
  await expect(learner.locator("[data-download-certificate]")).toBeVisible();
  assert.equal(posts, 1);
  await expect(learner.locator(".certificate-paper.is-preview")).toHaveCount(0);
  const id = await learner.locator(".certificate-id-box code").textContent();
  assert.match(id, /^ZI-/);
  assert.equal(await Certificate.countDocuments({ employeeId: first._id }), 1);
  const [download] = await Promise.all([
    learner.waitForEvent("download"),
    learner.locator("[data-download-certificate]").click(),
  ]);
  await download.saveAs(path.join(artifacts, "learner-download.pdf"));
  assert.equal(download.suggestedFilename(), `Zero-Incident-${id}.pdf`);
  assert.equal(
    (await readFile(path.join(artifacts, "learner-download.pdf")))
      .subarray(0, 4)
      .toString(),
    "%PDF",
  );
  await learner.screenshot({
    path: path.join(artifacts, "certificate-issued-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  await learner.reload();
  await expect(learner.locator(".certificate-id-box code")).toHaveText(id);
  await expect(learner.locator(".certificate-average")).toContainText(
    "98.6/100",
  );
  await learner.locator("[data-theme-toggle]").click();
  await expect(learner.locator("body")).toHaveAttribute("data-theme", "dark");
  await learner.screenshot({
    path: path.join(artifacts, "certificate-issued-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  await noOverflow(learner);
  console.log(
    "PASS: sample/69 locks, real 70 unlock, reviewed preview, guarded issuance, PDF download, reload and light/dark certificate page.",
  );
  await assess(learner, "hazard-perception");
  await User.updateOne(
    { _id: first._id },
    { $set: { firstName: "Lina Updated" } },
  );
  await learner.locator("[data-refresh-certificate]").click();
  // The issued record keeps the name and overall captured at issue.
  await expect(learner.locator(".certificate-recipient")).toHaveText(
    "Lina Thapa",
  );
  await expect(learner.locator(".certificate-average")).toContainText(
    "98.6/100",
  );
  await expect(learner.locator(".completion-results-foot")).toContainText(
    "98.6/100",
  );
  await expect(learner.locator(".certificate-snapshot-note")).toBeVisible();
  const admin = await page();
  await login(admin, "safety.admin", "ZeroIncident!2026");
  await admin.getByRole("link", { name: "Certificates", exact: true }).click();
  await admin.locator("#certificate-search").fill(id);
  await expect(admin.locator("[data-certificate-rows] tr")).toHaveCount(1);
  await expect(admin.locator("[data-certificate-rows]")).toContainText(
    "Lina Updated",
  );
  await admin.locator("[data-certificate-rows] a").click();
  await expect(admin.locator(".certificate-recipient")).toHaveText(
    "Lina Thapa",
  );
  const [adminDownload] = await Promise.all([
    admin.waitForEvent("download"),
    admin.locator("[data-download-certificate]").click(),
  ]);
  assert.equal(adminDownload.suggestedFilename(), `Zero-Incident-${id}.pdf`);
  const csrf = (await (await admin.request.get(base + "/api/session")).json())
    .csrfToken;
  await admin.request.patch(base + `/api/admin/employees/${first._id}/status`, {
    headers: { "X-CSRF-Token": csrf },
    data: { status: "inactive" },
  });
  await learner.locator("[data-download-certificate]").click();
  await expect(learner.locator("#login-form")).toBeVisible();
  assert.equal(
    (
      await admin.request.get(
        base + `/api/admin/employees/${first._id}/certificate/pdf`,
      )
    ).status(),
    200,
  );
  console.log(
    "PASS: issued name/marks retained after later changes, administrator search/view/download, employee deactivation blocks PDF access.",
  );
  const next = await page();
  await login(next, "certificate.second");
  for (const key of [
    "manual-handling",
    "working-at-height",
    "hazard-perception",
  ])
    await assess(next, key);
  await admin.goto(base + "/#/admin/certificates");
  await admin.locator("#certificate-filter").selectOption("ready");
  await admin.locator("#certificate-search").fill("Bimal");
  await expect(admin.locator("[data-certificate-rows] tr")).toHaveCount(1);
  await admin.locator("[data-certificate-rows] a").click();
  await expect(admin.locator("[data-issue-certificate]")).toBeVisible();
  await admin.locator("[data-issue-certificate]").click();
  await expect(admin.locator("[data-download-certificate]")).toBeVisible();
  await admin.goto(base + "/#/admin/certificates");
  await admin.locator("#certificate-filter").selectOption("issued");
  await admin.screenshot({
    path: path.join(artifacts, "admin-completion-records.png"),
    fullPage: true,
    animations: "disabled",
  });
  await next.setViewportSize({ width: 390, height: 740 });
  await next.goto(base + "/#/employee/certificates");
  await expect(next.locator("[data-download-certificate]")).toBeVisible();
  await noOverflow(next);
  await next.screenshot({
    path: path.join(artifacts, "certificate-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await next.setViewportSize({ width: 320, height: 640 });
  await noOverflow(next);
  await next.locator("[data-topbar-logout]").click();
  await expect(next.locator("#login-form")).toBeVisible();
  console.log(
    "PASS: administrator issuance, certificate filters, 390/320px layout and logout.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "ALL CERTIFICATE BROWSER CHECKS PASSED. No uncaught browser errors.",
  );
} catch (e) {
  let n = 0;
  for (const p of pages)
    await p
      .screenshot({
        path: path.join(artifacts, `failure-${n++}.png`),
        fullPage: true,
      })
      .catch(() => {});
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await app.locals.sessionStore.close();
  await disconnectDatabase();
  await rm(temp, { recursive: true, force: true });
}
