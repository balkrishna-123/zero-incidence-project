// End-to-end browser smoke test against an isolated, disposable database.
// Does not modify the running preview or your configured production database.
import { chromium, expect } from "@playwright/test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmp = await mkdtemp(path.join(os.tmpdir(), "zi-browser-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "true";
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = "browser-test-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");
const { seedDatabase } = await import("../server/seed.js");
const { ROOT } = await import("../server/config.js");
const artifacts = path.join(ROOT, "data", "browser-test-artifacts");
await mkdir(artifacts, { recursive: true });
const uri = await connectDatabase({ isolated: true });
await seedDatabase();
const app = await createApp(uri);
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
// --enable-unsafe-swiftshader: no-op on machines with a real GPU; in
// headless/CI environments it lets Chromium fall back to SwiftShader so
// the 360° lobby scenes still render.
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const errors = [];
async function newPage(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
// Screenshots are diagnostic artifacts, not assertions. Headless GPU
// (SwiftShader) full-page captures can flake when a WebGL canvas is on the
// page, so capture is best-effort: one retry, then skip rather than abort
// the run. The functional checks above are the pass/fail criteria.
async function shot(page, name) {
  const file = path.join(artifacts, name);
  try {
    await page.screenshot({ path: file, fullPage: true });
  } catch {
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  }
}
async function login(page, username, password) {
  await page.goto(base);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator(".login-submit").click();
}
try {
  const admin = await newPage();
  await login(admin, "safety.admin", "ZeroIncident!2026");
  await expect(
    admin.getByRole("heading", { name: "A safer start, for everyone." }),
  ).toBeVisible();
  await admin
    .getByRole("link", { name: "Register employee", exact: true })
    .click();
  await admin.locator("#firstName").fill("Samira");
  await admin.locator("#lastName").fill("Thapa");
  await admin.locator("#age").fill("22");
  await admin.locator("#username").fill("samira.test");
  await admin.locator("#temporaryPassword").fill("Welcome!2026");
  await admin.locator("#confirmPassword").fill("Welcome!2026");
  await admin
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    admin.getByRole("heading", { name: "Ready for a safer start." }),
  ).toBeVisible();
  await expect(admin.locator(".credential-box")).toContainText("samira.test");
  await admin.getByRole("button", { name: "Done", exact: true }).click();
  await admin.locator("#employee-search").fill("Samira");
  await expect(admin.locator("#employee-results .person")).toHaveCount(1);
  await admin.locator("#employee-results [data-detail]").click();
  await expect(
    admin.getByRole("heading", { name: "Employee overview", exact: true }),
  ).toBeVisible();
  await expect(admin.locator(".modal-body")).toContainText("Change required");
  await admin.getByRole("link", { name: "Edit account", exact: true }).click();
  await admin.locator("#age").fill("23");
  await admin
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await admin.locator("#employee-search").fill("Samira");
  await expect(admin.locator("#employee-results .person")).toHaveCount(1);
  await admin.locator("[data-status]").click();
  await admin.locator("#confirm-status").click();
  await expect(admin.locator(".modal")).toHaveCount(0);
  await admin.locator("#employee-search").fill("Samira");
  await expect(admin.locator("#employee-results .person")).toHaveCount(1);
  await expect(admin.locator("#employee-results .badge")).toHaveText(
    "Inactive",
  );
  await admin.locator("[data-status]").click();
  await admin.locator("#confirm-status").click();
  await expect(admin.locator(".modal")).toHaveCount(0);
  console.log(
    "PASS: employee create, one-time credentials, search, details, edit, deactivate and reactivate.",
  );

  const learner = await newPage();
  await login(learner, "samira.test", "Welcome!2026");
  await expect(learner.locator("#first-password-form")).toBeVisible();
  await shot(learner, "first-password.png");
  await learner.locator("#newPassword").fill("MyOwnSafety!2026");
  await learner.locator("#confirmPassword").fill("MyOwnSafety!2026");
  await learner.locator("#first-password-form button[type=submit]").click();
  await expect(learner.locator("#login-form")).toBeVisible();
  await learner.locator("#password").fill("MyOwnSafety!2026");
  await learner.locator(".login-submit").click();
  // Post-login home is the 360° warehouse lobby; starting the hub reveals
  // the trainer's introduction overlay.
  await expect(learner.locator("[data-game-start]")).toBeVisible({
    timeout: 15000,
  });
  await learner.locator("[data-game-start]").click();
  await expect(learner.locator("[data-game-intro]")).toBeVisible({
    timeout: 10000,
  });
  await shot(learner, "employee-hub.png");
  // The Hazard Perception module opens its journey (welcome or resumed stage).
  await learner.goto(`${base}/#/employee/module/hazard-perception`);
  await expect(learner.locator(".training-back")).toContainText(
    "Back to training hub",
    { timeout: 15000 },
  );
  await expect(
    learner.getByRole("heading", {
      name: "Hazard Perception — the module journey",
    }),
  ).toBeVisible({ timeout: 15000 });
  await learner
    .getByRole("link", { name: "Back to training hub", exact: true })
    .click();
  // The 360° hub mount re-renders the shell; wait for it to settle. The
  // lobby navigates through its own HUD buttons, not the sidebar links.
  await expect(learner.locator("[data-game-start]")).toBeVisible({
    timeout: 15000,
  });
  await learner
    .getByRole("button", { name: "My progress", exact: true })
    .click();
  await expect(learner.locator(".detail-module")).toHaveCount(3);
  await learner
    .getByRole("link", { name: "Certificates", exact: true })
    .click();
  await expect(learner.locator(".certificate-locked")).toContainText("0/3");
  await expect(learner.locator("[data-issue-certificate]")).toHaveCount(0);
  // A learner must not reach the admin workspace — protected routing
  // bounces them back to their own home (the 360° hub).
  await learner.goto(`${base}/#/admin/overview`);
  await expect(
    learner.locator("[data-game-start]"),
  ).toBeVisible({ timeout: 15000 });
  await expect(learner).toHaveURL(/#\/employee\/hub$/);
  console.log(
    "PASS: mandatory password change → return to login → 360° warehouse lobby, Hazard Perception journey, progress and locked certificate.",
  );

  await admin
    .getByRole("link", { name: "Virtual trainers", exact: true })
    .click();
  await expect(
    admin.getByRole("heading", { name: "Meet your safety guides." }),
  ).toBeVisible();
  await shot(admin, "virtual-trainers.png");
  await admin
    .getByRole("link", { name: "Create trainer", exact: true })
    .click();
  await admin
    .locator("#trainer-image")
    .setInputFiles(path.join(ROOT, "public/assets/yeti-trainer.png"));
  await admin.locator("#firstName").fill("Safety");
  await admin.locator("#lastName").fill("Scout");
  await admin.locator("#nickname").fill("Scout");
  await admin.locator("#age").fill("31");
  await admin.locator("#introduction").fill("Welcome! I am Scout. Let’s spot hazards together.");
  // Trainers have real sign-ins — the create form now issues credentials.
  await admin.locator("#username").fill("scout.t");
  await admin.locator("#temporaryPassword").fill("ScoutGuide!2026");
  await admin.locator("#confirmPassword").fill("ScoutGuide!2026");
  await admin.locator('[name=moduleKeys][value="hazard-perception"]').check();
  await admin
    .getByRole("button", { name: "Create trainer", exact: true })
    .click();
  await expect(admin.locator(".trainer-card")).toHaveCount(2);
  await admin.locator("#trainer-search").fill("Scout");
  await expect(admin.locator(".trainer-card")).toHaveCount(1);
  await admin.locator("[data-trainer-status]").click();
  await admin.locator("#confirm-status").click();
  await expect(admin.locator(".modal")).toHaveCount(0);
  await admin.locator("#trainer-search").fill("Scout");
  await expect(admin.locator(".trainer-card .badge").first()).toHaveText(
    "Inactive",
  );
  await admin.locator("[data-trainer-delete]").click();
  await admin.locator("#confirmation").fill("Scout");
  await admin
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(admin.locator(".modal")).toHaveCount(0);
  await expect(admin.locator(".trainer-card")).toHaveCount(1);
  console.log(
    "PASS: trainer image upload, module assignment, search, deactivation and confirmed deletion.",
  );

  await admin
    .getByRole("link", { name: "Learning progress", exact: true })
    .click();
  // 6 seeded employees + samira.test (created above) + the seeded trainer
  // account (trainers have real sign-ins and appear in progress).
  await expect(admin.locator("#progress-results tbody tr")).toHaveCount(8);
  await admin.locator("#progress-filter").selectOption("complete");
  await expect(admin.locator("#progress-results tbody tr")).toHaveCount(1);
  const downloaded = admin.waitForEvent("download");
  await admin.locator("#export-progress").click();
  const download = await downloaded;
  if (!download.suggestedFilename().endsWith(".csv"))
    throw new Error("CSV export missing.");
  await shot(admin, "progress.png");
  await admin.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(admin.locator("#change-password-form")).toBeVisible();
  console.log("PASS: progress filters, CSV download and account settings.");

  const mobile = await newPage({ width: 390, height: 844 });
  await mobile.goto(base);
  await expect(mobile.locator("#login-form")).toBeVisible();
  await shot(mobile, "mobile-login.png");
  await mobile.locator("[data-demo=admin]").click();
  await mobile.locator(".login-submit").click();
  await expect(
    mobile.getByRole("heading", { name: "A safer start, for everyone." }),
  ).toBeVisible();
  await mobile.locator("[data-sidebar-open]").click();
  await mobile
    .getByRole("link", { name: "Manage employees", exact: true })
    .click();
  await mobile
    .getByRole("link", { name: "Register employee", exact: true })
    .click();
  await expect(mobile.locator("#employee-form")).toBeVisible();
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflow) throw new Error("Mobile viewport has horizontal overflow.");
  await shot(mobile, "mobile-register.png");
  console.log(
    "PASS: mobile sign-in, navigation, registration and no page-width overflow.",
  );
  if (errors.length)
    throw new Error(`Uncaught browser errors: ${errors.join("; ")}`);
  console.log("ALL BROWSER CHECKS PASSED. No uncaught browser errors.");
} catch (error) {
  for (const [i, context] of browser.contexts().entries()) {
    const page = context.pages()[0];
    if (page)
      await page
        .screenshot({
          path: path.join(artifacts, `failure-${i}.png`),
          fullPage: true,
        })
        .catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await app.locals.sessionStore.close();
  await disconnectDatabase();
  await rm(tmp, { recursive: true, force: true });
}
