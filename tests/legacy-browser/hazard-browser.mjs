import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const temp = await mkdtemp(path.join(os.tmpdir(), "zi-hazard-browser-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "true";
process.env.DATA_DIR = temp;
process.env.SESSION_SECRET = "hazard-browser-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");
const { seedDatabase } = await import("../server/seed.js");
const { User } = await import("../server/models.js");
const { hashPassword } = await import("../server/passwords.js");
const { COURSES } = await import("../server/training-content.js");
const c = COURSES["hazard-perception"];
const isHazard = (id) => c.tasks.some((t) => t.objectId === id);
const artifacts = path.resolve("data/hazard-browser-artifacts");
await mkdir(artifacts, { recursive: true });
const uri = await connectDatabase({ isolated: true });
await seedDatabase();
const hash = await hashPassword("Learning!2026");
await User.create([
  {
    firstName: "Nima",
    lastName: "Rai",
    age: 26,
    username: "hazard.learner",
    role: "employee",
    passwordHash: hash,
    mustChangePassword: false,
  },
  {
    firstName: "Accessible",
    lastName: "Learner",
    age: 25,
    username: "hazard.accessible",
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
const contexts = [];
const errors = [];
async function newPage(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}
async function login(page, username = "hazard.learner") {
  await page.goto(base);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("Learning!2026");
  await page.locator(".login-submit").click();
  await expect(page.locator(".module-card")).toHaveCount(3);
}
async function current(page) {
  const id = new URLSearchParams(page.url().split("?")[1]).get("attempt");
  assert.ok(id);
  const r = await page.request.get(base + "/api/training/attempts/" + id);
  assert.equal(r.status(), 200);
  return r.json();
}
async function noOverflow(page) {
  const v = await page.evaluate(() => [
    innerWidth,
    document.documentElement.scrollWidth,
  ]);
  assert.ok(v[1] <= v[0] + 1, v.join(" / "));
}
async function inspect(page, id) {
  await page.locator(`[data-checkpoint="${id}"] [data-inspect-object]`).click();
  await expect(page.locator("[data-classify]")).toHaveCount(2);
}
async function classify(page, flagged) {
  await page
    .locator(`[data-classify="${flagged ? "hazard" : "clear"}"]`)
    .click();
  await expect(
    page.locator("[data-lesson-panel] [data-feedback]"),
  ).toBeVisible();
}
async function nextFeedback(page) {
  await page.locator("[data-lesson-panel] [data-feedback-next]").click();
}
async function control(page, id, correct = true) {
  const t = c.tasks.find((t) => t.objectId === id);
  await expect(page.locator("[data-activity-option]")).toHaveCount(3);
  await page
    .locator(
      `[data-activity-option="${correct ? t.correctId : t.options.find((o) => o.id !== t.correctId).id}"]`,
    )
    .click();
  await expect(
    page.locator("[data-lesson-panel] [data-feedback]"),
  ).toBeVisible();
}
async function answerQuiz(page) {
  const a = (await current(page)).attempt;
  const q = c.questions.find((q) => q.id === a.currentQuestion.id);
  await page.locator(`[data-quiz-option="${q.correctId}"]`).click();
  await expect(page.locator("[data-assessment] [data-feedback]")).toBeVisible();
  await page.locator("[data-assessment] [data-feedback-next]").click();
}
try {
  const page = await newPage();
  await login(page);
  await expect(page.locator('[data-module="hazard-perception"]')).toContainText(
    "Start training",
  );
  await page.locator('[data-module="hazard-perception"]').click();
  await expect(page.locator("[data-warehouse]")).toHaveAttribute(
    "data-scene-ready",
    "true",
    { timeout: 25000 },
  );
  await expect(page.locator("[data-warehouse]")).toHaveAttribute(
    "data-camera-settled",
    "true",
  );
  await expect(page.locator(".checkpoint")).toHaveCount(8);
  await expect(page.locator("[data-start-training]")).toBeDisabled();
  await noOverflow(page);
  await page.screenshot({
    path: path.join(artifacts, "hazard-intro.png"),
    fullPage: true,
    animations: "disabled",
  });
  const before = await page.locator(".warehouse-canvas").screenshot();
  await page.locator(".warehouse-canvas").focus();
  for (let n = 0; n < 7; n++) await page.keyboard.press("ArrowRight");
  const after = await page.locator(".warehouse-canvas").screenshot();
  assert.equal(before.equals(after), false);
  await page.locator('[data-look="reset"]').click();
  await page.locator("#training-ack").check();
  await page.locator("[data-start-training]").click();
  await expect(page.locator("[data-lesson-panel]")).toContainText(
    "Observe. Decide. Act safely.",
  );
  await page.locator('[data-scene-object="area-a"]').click();
  await expect(page.locator("[data-classify]")).toHaveCount(2);
  await expect(page.locator("[data-activity-option]")).toHaveCount(0);
  assert.equal((await current(page)).attempt.activityScore, 0);
  await classify(page, true);
  await expect(
    page.locator("[data-lesson-panel] .feedback-points"),
  ).toContainText("7 / 7");
  await nextFeedback(page);
  await control(page, "area-a");
  await expect(page.locator("[data-lesson-panel]")).toContainText(
    "Identification 7/7",
  );
  await page
    .locator(".warehouse-frame")
    .screenshot({ path: path.join(artifacts, "spill-controls.png") });
  await nextFeedback(page);
  // Inspect a comparison area, leave it, then intentionally misclassify it once.
  await inspect(page, "area-g");
  await page
    .locator("[data-lesson-panel] [data-walk-overview]")
    .first()
    .click();
  let state = (await current(page)).attempt;
  assert.equal(state.falseFlagCount, 0);
  assert.equal(state.areasReviewed, 1);
  await inspect(page, "area-g");
  await classify(page, true);
  await expect(page.locator("[data-lesson-panel]")).toContainText(
    "−2 activity marks",
  );
  await nextFeedback(page);
  await page.locator('[data-focus-object="area-g"]').click();
  await page.locator('[data-scene-object="area-g"]').click();
  await expect(page.locator("[data-lesson-panel]")).toContainText(
    "Already reviewed",
  );
  const id = (await current(page)).attempt.id;
  await page.reload();
  await expect(page.locator("[data-lesson-panel]")).toContainText(
    "Already reviewed",
  );
  assert.equal((await current(page)).attempt.id, id);
  assert.equal((await current(page)).attempt.falseFlagCount, 1);
  await expect(page.locator("[data-warehouse]")).toHaveAttribute(
    "data-scene-ready",
    "true",
  );
  await page.evaluate(
    () => (window.savedCanvas = document.querySelector(".warehouse-canvas")),
  );
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
  assert.equal(
    await page.evaluate(
      () => window.savedCanvas === document.querySelector(".warehouse-canvas"),
    ),
    true,
  );
  await page
    .locator("[data-lesson-panel] [data-walk-overview]")
    .first()
    .click();
  await page.screenshot({
    path: path.join(artifacts, "hazard-walk-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (const area of [
    "area-e",
    "area-c",
    "area-f",
    "area-d",
    "area-h",
    "area-b",
  ]) {
    await inspect(page, area);
    await classify(page, isHazard(area));
    await nextFeedback(page);
    if (isHazard(area)) {
      await control(page, area);
      await expect(page.locator("[data-warehouse]")).toHaveAttribute(
        "data-camera-settled",
        "true",
      );
      await page
        .locator(".warehouse-frame")
        .screenshot({ path: path.join(artifacts, `${area}-controls.png`) });
      await nextFeedback(page);
    }
    await noOverflow(page);
  }
  state = (await current(page)).attempt;
  assert.equal(state.areasReviewed, 8);
  assert.equal(state.activityDone, 5);
  assert.equal(state.phase, "quiz-ready");
  assert.equal(state.activityScore, 68);
  await expect(page.locator(".activity-total strong")).toContainText("68");
  console.log(
    "PASS: rendered 3D, keyboard/marker controls, free-order inspection, immutable area decisions, one-time false-flag penalty, reload and theme preservation.",
  );
  await page.locator("[data-quiz-next]").click();
  await expect(page.locator("[data-quiz-option]")).toHaveCount(3);
  const deadline = (await current(page)).attempt.currentQuestion.deadline;
  await page.reload();
  await expect(page.locator("[data-quiz-option]")).toHaveCount(3);
  assert.equal(
    (await current(page)).attempt.currentQuestion.deadline,
    deadline,
  );
  await page.screenshot({
    path: path.join(artifacts, "hazard-quiz.png"),
    fullPage: true,
    animations: "disabled",
  });
  await expect(page.locator("[data-assessment] [data-feedback]")).toContainText(
    "TIME EXPIRED",
    { timeout: 25000 },
  );
  await expect(page.locator(".quiz-top")).toContainText("2 / 5", {
    timeout: 10000,
  });
  for (let n = 1; n < 5; n++) await answerQuiz(page);
  await expect(page.locator("[data-module-result]")).toBeVisible();
  await expect(page.locator(".result-ring strong")).toHaveText("92");
  await expect(page.locator(".training-stars")).toHaveAttribute(
    "aria-label",
    "3 of 3 stars",
  );
  await expect(
    page.locator(".hunt-inspection-review .answer-review"),
  ).toHaveCount(8);
  await expect(page.locator(".answer-review")).toHaveCount(18);
  await page.screenshot({
    path: path.join(artifacts, "hazard-result.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(page.locator(".result-ring strong")).toHaveText("92");
  await page
    .getByRole("link", { name: "View my progress", exact: true })
    .click();
  await expect(page.locator(".detail-module").nth(2)).toContainText("92");
  await expect(page.locator(".detail-module").first()).toContainText(
    "No assessment yet",
  );
  await expect(page.locator(".warehouse-canvas")).toHaveCount(0);
  console.log(
    "PASS: real quiz timeout and auto-next, no deadline reset, 92/100 saved result, detailed area/response review and separate Hazard progress.",
  );
  await page.getByRole("link", { name: "Training hub", exact: true }).click();
  await page.locator('[data-module="hazard-perception"]').click();
  await page.locator("[data-history-id]").first().click();
  await expect(page.locator(".result-ring strong")).toHaveText("92");
  await page.setViewportSize({ width: 390, height: 740 });
  await page.locator("[data-retry-training]").click();
  // Missing every hazard but choosing every control correctly must still fail,
  // even with a perfect quiz: 35 + 30 = 65.
  for (const [index, o] of c.objects.entries()) {
    await inspect(page, o.id);
    await classify(page, false);
    await nextFeedback(page);
    if (isHazard(o.id)) {
      await control(page, o.id);
      await expect(page.locator("[data-lesson-panel]")).toContainText(
        "Good control. Review the identification.",
      );
      if (index === 2)
        await page.screenshot({
          path: path.join(artifacts, "hazard-mobile.png"),
          fullPage: true,
          animations: "disabled",
        });
      await nextFeedback(page);
    }
    await noOverflow(page);
  }
  await page.locator("[data-quiz-next]").click();
  for (let n = 0; n < 5; n++) await answerQuiz(page);
  await expect(page.locator(".result-ring strong")).toHaveText("65");
  await expect(page.locator(".result-summary .training-best")).toContainText(
    "92/100",
  );
  await noOverflow(page);
  await page.locator("[data-topbar-logout]").click();
  await expect(page.locator("#login-form")).toBeVisible();
  assert.equal(
    (await page.request.get(base + "/api/training/attempts/" + id)).status(),
    401,
  );
  console.log(
    "PASS: mobile classification/control/quiz layouts, meaningful failed retake, preserved best score and server sign-out.",
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
  await login(accessible, "hazard.accessible");
  await accessible.locator('[data-module="hazard-perception"]').click();
  await expect(accessible.locator("[data-warehouse]")).toHaveAttribute(
    "data-scene-ready",
    "fallback",
  );
  await expect(accessible.locator(".scene-fallback")).toContainText(
    "eight area judgements",
  );
  await accessible.locator("#training-ack").check();
  await accessible.locator("[data-start-training]").click();
  for (const o of [...c.objects].reverse()) {
    await inspect(accessible, o.id);
    await classify(accessible, isHazard(o.id));
    await nextFeedback(accessible);
    if (isHazard(o.id)) {
      await control(accessible, o.id);
      await nextFeedback(accessible);
    }
    await noOverflow(accessible);
  }
  await accessible.locator("[data-quiz-next]").click();
  for (let n = 0; n < 5; n++) await answerQuiz(accessible);
  await expect(accessible.locator(".result-ring strong")).toHaveText("100");
  await noOverflow(accessible);
  console.log(
    "PASS: all eight judgements and five responses plus the quiz can earn 100/100 through the no-WebGL 320px fallback.",
  );
  const token = (
    await (await accessible.request.get(base + "/api/session")).json()
  ).csrfToken;
  const manual = await accessible.request.post(
    base + "/api/training/manual-handling/start",
    { headers: { "X-CSRF-Token": token }, data: { acknowledged: true } },
  );
  assert.equal(manual.status(), 200);
  await accessible.goto(
    base +
      "/#/employee/module/hazard-perception?attempt=" +
      (await manual.json()).attempt.id,
  );
  await expect(accessible.locator(".training-error")).toContainText(
    "different module",
  );
  await expect(accessible.locator(".result-ring")).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "ALL HAZARD PERCEPTION BROWSER CHECKS PASSED. No uncaught browser errors.",
  );
} catch (e) {
  let n = 0;
  for (const context of contexts)
    for (const page of context.pages())
      await page
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
