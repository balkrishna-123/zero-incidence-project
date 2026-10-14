// Full Working at Height browser flow using a disposable MongoDB instance.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const tmp = await mkdtemp(path.join(os.tmpdir(), "zi-height-browser-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "true";
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = "manual-browser-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");
const { seedDatabase } = await import("../server/seed.js");
const { User } = await import("../server/models.js");
const { hashPassword } = await import("../server/passwords.js");
const { COURSES } = await import("../server/training-content.js");
const course = COURSES["working-at-height"];
const artifacts = path.resolve("data/height-browser-artifacts");
await mkdir(artifacts, { recursive: true });
const uri = await connectDatabase({ isolated: true });
await seedDatabase();
const hash = await hashPassword("Learning!2026");
await User.create([
  {
    firstName: "Asha",
    lastName: "Rai",
    age: 24,
    username: "height.learner",
    role: "employee",
    passwordHash: hash,
    mustChangePassword: false,
  },
  {
    firstName: "Accessible",
    lastName: "Learner",
    age: 26,
    username: "accessible.learner",
    role: "employee",
    passwordHash: hash,
    mustChangePassword: false,
  },
]);
const app = await createApp(uri);
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const errors = [];
const contexts = [];
async function newPage(viewport = { width: 1440, height: 970 }) {
  const context = await browser.newContext({ viewport });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}
async function login(page, username = "height.learner") {
  await page.goto(base);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("Learning!2026");
  await page.locator(".login-submit").click();
  await expect(page.locator(".module-card")).toHaveCount(3);
}
async function state(page) {
  const id = new URLSearchParams(page.url().split("?")[1]).get("attempt");
  assert.ok(id);
  const r = await page.request.get(`${base}/api/training/attempts/${id}`);
  assert.equal(r.status(), 200);
  return r.json();
}
async function noOverflow(page) {
  const v = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(v.scroll <= v.width + 1, JSON.stringify(v));
}
async function chooseActivity(page, task, correct = true) {
  const optionId = correct
    ? task.correctId
    : task.options.find((o) => o.id !== task.correctId).id;
  await page.locator(`[data-activity-option="${optionId}"]`).click();
  await expect(
    page.locator("[data-lesson-panel] [data-feedback]"),
  ).toBeVisible();
  if (correct && page.viewportSize().width >= 1050) {
    await expect(page.locator("[data-warehouse]")).toHaveAttribute(
      "data-camera-settled",
      "true",
    );
    await page.locator(".warehouse-frame").screenshot({
      path: path.join(artifacts, `height-${task.objectId}-after.png`),
    });
  }
  await page.locator("[data-lesson-panel] [data-feedback-next]").click();
}
try {
  const page = await newPage();
  await login(page);
  await expect(page.locator('[data-module="working-at-height"]')).toContainText(
    "Start training",
  );
  await expect(page.locator('[data-module="hazard-perception"]')).toContainText(
    "Start training",
  );
  await page.locator('[data-module="working-at-height"]').click();
  await expect(page.locator("[data-warehouse]")).toHaveAttribute(
    "data-scene-ready",
    "true",
    { timeout: 25000 },
  );
  await expect(page.locator("[data-start-training]")).toBeDisabled();
  await noOverflow(page);
  await expect(page.locator("[data-warehouse]")).toHaveAttribute(
    "data-camera-settled",
    "true",
  );
  await page.screenshot({
    path: path.join(artifacts, "height-intro.png"),
    fullPage: true,
    animations: "disabled",
  });
  const before = await page.locator(".warehouse-canvas").screenshot();
  await page.locator(".warehouse-canvas").focus();
  for (let n = 0; n < 8; n++) await page.keyboard.press("ArrowRight");
  const after = await page.locator(".warehouse-canvas").screenshot();
  assert.equal(before.equals(after), false);
  await page.locator('[data-look="reset"]').click();
  await page.locator("#training-ack").check();
  await page.locator("[data-start-training]").click();
  await expect(page.locator("[data-lesson-panel]")).toContainText(
    "CHECKPOINT 1 OF 5",
  );
  await page.locator('[data-scene-object="ground-tool"]').click();
  await expect(page.locator("[data-activity-option]")).toHaveCount(3);
  await chooseActivity(page, course.tasks[0]);
  await page
    .locator('[data-lesson-panel] [data-inspect-object="ladder"]')
    .click();
  await expect(page.locator("[data-activity-option]")).toHaveCount(3);
  const id = (await state(page)).attempt.id;
  await page.reload();
  await expect(page.locator("[data-activity-option]")).toHaveCount(3);
  assert.equal((await state(page)).attempt.id, id);
  await expect(page.locator("[data-warehouse]")).toHaveAttribute(
    "data-scene-ready",
    "true",
  );
  await page.evaluate(
    () =>
      (window.originalSceneCanvas =
        document.querySelector(".warehouse-canvas")),
  );
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
  assert.equal(
    await page.evaluate(
      () =>
        window.originalSceneCanvas ===
        document.querySelector(".warehouse-canvas"),
    ),
    true,
  );
  await expect
    .poll(() =>
      page
        .locator("[data-lesson-panel]")
        .evaluate((el) => getComputedStyle(el.parentElement).backgroundColor),
    )
    .toBe("rgb(25, 26, 30)");
  await page.screenshot({
    path: path.join(artifacts, "height-activity-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  await chooseActivity(page, course.tasks[1]);
  for (const task of course.tasks.slice(2)) {
    await page
      .locator(`[data-lesson-panel] [data-inspect-object="${task.objectId}"]`)
      .click();
    await expect(page.locator("[data-warehouse]")).toHaveAttribute(
      "data-camera-settled",
      "true",
    );
    await page.locator(".warehouse-frame").screenshot({
      path: path.join(artifacts, `height-${task.objectId}-before.png`),
    });
    await chooseActivity(page, task);
  }
  await expect(page.locator("[data-lesson-panel]")).toContainText("70");
  await expect(page.locator("[data-lesson-panel]")).toContainText(
    "Ready to check your knowledge?",
  );
  console.log(
    "PASS: 3D scene, keyboard look-around, actual marker inspection, five practical checkpoints, saved reload and theme preservation.",
  );
  await page.locator("[data-quiz-next]").click();
  await expect(page.locator("[data-quiz-option]")).toHaveCount(3);
  const q1 = (await state(page)).attempt.currentQuestion;
  await page.reload();
  await expect(page.locator("[data-quiz-option]")).toHaveCount(3);
  assert.equal(
    (await state(page)).attempt.currentQuestion.deadline,
    q1.deadline,
  );
  await page.screenshot({
    path: path.join(artifacts, "height-timed-quiz.png"),
    fullPage: true,
    animations: "disabled",
  });
  // Allow a real 20-second deadline to elapse, then do not click Next: test auto-next.
  await expect(page.locator("[data-assessment] [data-feedback]")).toContainText(
    "TIME EXPIRED",
    { timeout: 25000 },
  );
  await expect(page.locator(".quiz-top")).toContainText("2 / 5", {
    timeout: 10000,
  });
  for (let index = 1; index < 5; index++) {
    const current = (await state(page)).attempt.currentQuestion;
    const q = course.questions.find((q) => q.id === current.id);
    await page.locator(`[data-quiz-option="${q.correctId}"]`).click();
    await expect(
      page.locator("[data-assessment] [data-feedback]"),
    ).toBeVisible();
    await page.locator("[data-assessment] [data-feedback-next]").click();
  }
  await expect(page.locator("[data-module-result]")).toBeVisible();
  await expect(page.locator(".result-ring strong")).toHaveText("94");
  await expect(page.locator(".result-summary")).toContainText("Excellent");
  await expect(page.locator(".training-stars")).toHaveAttribute(
    "aria-label",
    "3 of 3 stars",
  );
  await expect(page.locator(".answer-review")).toHaveCount(10);
  await page.screenshot({
    path: path.join(artifacts, "height-result.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(page.locator(".result-ring strong")).toHaveText("94");
  await page
    .getByRole("link", { name: "View my progress", exact: true })
    .click();
  await expect(page.locator(".detail-module").nth(1)).toContainText("94");
  await expect(page.locator(".detail-module").first()).toContainText(
    "No assessment yet",
  );
  await expect(page.locator(".warehouse-canvas")).toHaveCount(0);
  console.log(
    "PASS: real quiz timeout, no timer reset on reload, automatic next question, 94/100 result, feedback/stars and saved employee progress.",
  );
  await page.getByRole("link", { name: "Training hub", exact: true }).click();
  await page.locator('[data-module="working-at-height"]').click();
  await page.locator("[data-history-id]").first().click();
  await expect(page.locator(".result-ring strong")).toHaveText("94");
  await page.setViewportSize({ width: 390, height: 740 });
  await page.locator("[data-retry-training]").click();
  await expect(page.locator("[data-lesson-panel]")).toContainText(
    "CHECKPOINT 1 OF 5",
  );
  for (const [index, task] of course.tasks.entries()) {
    await page
      .locator(`[data-lesson-panel] [data-inspect-object="${task.objectId}"]`)
      .click();
    await noOverflow(page);
    if (index === 1)
      await page.screenshot({
        path: path.join(artifacts, "height-mobile.png"),
        fullPage: true,
        animations: "disabled",
      });
    await chooseActivity(page, task, false);
  }
  await page.locator("[data-quiz-next]").click();
  for (let n = 0; n < 5; n++) {
    await page.locator("[data-quiz-skip]").click();
    await expect(
      page.locator("[data-assessment] [data-feedback]"),
    ).toBeVisible();
    await noOverflow(page);
    await page.locator("[data-assessment] [data-feedback-next]").click();
  }
  await expect(page.locator(".result-ring strong")).toHaveText("0");
  await expect(page.locator(".result-summary .training-best")).toContainText(
    "94/100",
  );
  await noOverflow(page);
  await page.locator("[data-topbar-logout]").click();
  await expect(page.locator("#login-form")).toBeVisible();
  assert.equal(
    (await page.request.get(`${base}/api/training/attempts/${id}`)).status(),
    401,
  );
  console.log(
    "PASS: mobile activity and quiz layouts, failed retake, retained best score, scene cleanup and real sign-out.",
  );

  const mismatch = await newPage({ width: 1280, height: 780 });
  await login(mismatch);
  const token = (
    await (await mismatch.request.get(base + "/api/session")).json()
  ).csrfToken;
  const manualStart = await mismatch.request.post(
    base + "/api/training/manual-handling/start",
    {
      headers: { "X-CSRF-Token": token },
      data: { acknowledged: true },
    },
  );
  assert.equal(manualStart.status(), 200);
  const manualAttempt = (await manualStart.json()).attempt.id;
  await mismatch.goto(
    base + "/#/employee/module/working-at-height?attempt=" + manualAttempt,
  );
  await expect(mismatch.locator(".training-error")).toContainText(
    "different module",
  );
  await expect(mismatch.locator(".result-ring")).toHaveCount(0);
  await mismatch.locator("[data-topbar-logout]").click();
  console.log(
    "PASS: a Manual Handling attempt ID cannot be displayed or scored under the Height heading.",
  );

  const accessible = await newPage({ width: 320, height: 640 });
  await accessible.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith("webgl")
        ? null
        : original.call(this, type, ...args);
    };
  });
  await login(accessible, "accessible.learner");
  await accessible.locator('[data-module="working-at-height"]').click();
  await expect(accessible.locator("[data-warehouse]")).toHaveAttribute(
    "data-scene-ready",
    "fallback",
  );
  await accessible.locator("#training-ack").check();
  await accessible.locator("[data-start-training]").click();
  for (const task of course.tasks) {
    await accessible
      .locator(`[data-lesson-panel] [data-inspect-object="${task.objectId}"]`)
      .click();
    await chooseActivity(accessible, task);
  }
  await accessible.locator("[data-quiz-next]").click();
  for (let n = 0; n < 5; n++) {
    const current = (await state(accessible)).attempt.currentQuestion;
    const q = course.questions.find((q) => q.id === current.id);
    await accessible.locator(`[data-quiz-option="${q.correctId}"]`).click();
    await accessible.locator("[data-assessment] [data-feedback-next]").click();
  }
  await expect(accessible.locator(".result-ring strong")).toHaveText("100");
  await noOverflow(accessible);
  console.log(
    "PASS: no-WebGL accessible fallback completes the identical 100-mark assessment at 320px width.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "ALL WORKING AT HEIGHT BROWSER CHECKS PASSED. No uncaught browser errors.",
  );
} catch (e) {
  let index = 0;
  for (const context of contexts)
    for (const page of context.pages())
      await page
        .screenshot({
          path: path.join(artifacts, `failure-${index++}.png`),
          fullPage: true,
        })
        .catch(() => {});
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await app.locals.sessionStore.close();
  await disconnectDatabase();
  await rm(tmp, { recursive: true, force: true });
}
