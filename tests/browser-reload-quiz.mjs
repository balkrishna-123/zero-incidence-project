// Regression test for the mid-quiz crash: "Cannot read properties of
// undefined (reading 'map')" — the quiz stage read per-question data from
// the course overview, which only carries a question count. It must use the
// attempt's own level state instead.
//
// Requires a RUNNING server (npm start) and a demo employee:
//   APP_BASE=http://localhost:3000 npm run test:journey:browser
// Logs in as bikash.t / DemoOnly!2026 (dev demo seed) and drives:
//   1) a mid-quiz attempt must resume on page load (quiz + options render)
//   2) answering shows feedback
//   3) RELOAD mid-quiz must re-render the quiz with options (no error box)
import { chromium } from "@playwright/test";

const base = process.env.APP_BASE || "http://localhost:3100";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error") logs.push(`[console.error] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("response", (r) => {
  if (r.url().includes("/api/") && r.status() >= 400)
    logs.push(`[http ${r.status()}] ${r.request().method()} ${r.url()}`);
});
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

await page.goto(base, { waitUntil: "networkidle" });
await page.locator("#username").fill("bikash.t");
await page.locator("#password").fill("DemoOnly!2026");
await page.locator(".login-submit").click();
await page.waitForTimeout(1500);

await page.goto(base + "/#/employee/module/working-at-height", {
  waitUntil: "networkidle",
});

// The stage briefly shows the welcome screen while the active attempt loads,
// then the real state (e.g. the PREVIOUS FORMAT card) replaces it. Ask the
// API (same session) which stable state to expect and wait for exactly that,
// so the transient welcome is never mistaken for a fresh journey.
const ovRes = await page.request.get(
  base + "/api/training/working-at-height",
);
const ov = await ovRes.json();
let expectLegacy = false;
let needFreshForHint = false;
if (ov.activeAttemptId) {
  const atRes = await page.request.get(
    base + `/api/training/attempts/${ov.activeAttemptId}`,
  );
  const attempt = (await atRes.json()).attempt;
  expectLegacy = Boolean(attempt?.legacy);
  if (!expectLegacy && attempt?.currentQuestion) {
    // The hint-bubble check below needs a question whose hint has not been
    // consumed yet. A previous run of this test (or the employee's own
    // retry) may already have spent it — hints are single-use. Retire the
    // attempt and start fresh, exactly like the UI's "Start the module
    // journey" button does, so the hint check stays deterministic.
    const level = (attempt.levels || [])[attempt.levelIndex];
    const cur = (level?.questions || []).find(
      (q) => q.id === attempt.currentQuestion.id,
    );
    needFreshForHint = Boolean(cur?.hintUsed);
  }
}
if (needFreshForHint) {
  console.log(
    "  (current question's hint already used — starting a fresh journey for a live hint)",
  );
  await page.request.post(base + "/api/training/working-at-height/start", {
    data: { acknowledged: true },
  });
  await page.reload({ waitUntil: "networkidle" });
}
// Predicates run in the page context, so each must be self-contained.
const waitLegacyCard = () =>
  page.waitForFunction(
    () => {
      const s = document.querySelector("[data-stage]");
      const eb = s && s.querySelector(".lesson-eyebrow");
      return Boolean(eb && eb.textContent.includes("PREVIOUS FORMAT"));
    },
    { timeout: 20000 },
  );
const waitIntro = () =>
  page.waitForFunction(
    () => {
      const s = document.querySelector("[data-stage]");
      if (!s || !s.querySelector("[data-advance]")) return false;
      const eb = s.querySelector(".lesson-eyebrow");
      return !(eb && eb.textContent.includes("PREVIOUS FORMAT"));
    },
    { timeout: 15000 },
  );
if (expectLegacy) {
  await waitLegacyCard();
} else {
  await page.waitForFunction(() => {
    const s = document.querySelector("[data-stage]");
    return (
      s &&
      (s.querySelector(".training-choice") ||
        s.querySelector("#training-ack") ||
        s.querySelector("[data-study-frame]") ||
        s.querySelector("[data-advance]") ||
        s.querySelector(".training-error:not([hidden])"))
    );
  }, { timeout: 20000 });
}

const quizVisible = () => page.locator(".training-choice").count() > 0;
if (
  await page
    .locator(".lesson-eyebrow:has-text('PREVIOUS FORMAT')")
    .first()
    .isVisible()
    .catch(() => false)
) {
  // legacy in-progress attempt: start the fresh journey instead
  console.log("  (resumed attempt is previous-format — starting fresh journey)");
  await page.locator("[data-start-journey]").click();
  await waitIntro();
}
if (await page.locator("#training-ack").isVisible().catch(() => false)) {
  // fresh attempt: walk welcome -> intro
  await page.locator("#training-ack").check();
  await page.locator("[data-start-journey]").click();
  await waitIntro();
}
// intro -> study (study scene takes a moment to build)
if (await page.locator("[data-advance]").first().isVisible().catch(() => false)) {
  await page.locator("[data-advance]").first().click();
  await page.waitForTimeout(3000);
}
// study -> quiz
if (await page.locator("[data-advance]").first().isVisible().catch(() => false)) {
  await page.locator("[data-advance]").first().click();
  await page.waitForTimeout(2000);
}
await page.waitForFunction(() =>
  document.querySelector("[data-stage] .training-choice"),
).catch(() => {});

// 1) quiz must render with three options
const choiceCount = await page.locator(".training-choice").count();
check("quiz renders on load/resume with 3 options", choiceCount === 3, `count=${choiceCount}`);
check("no error box", !(await page.locator(".training-error").isVisible().catch(() => false)));
const note = await page.locator(".quiz-mark-note").innerText().catch(() => "");
check("question counter shows OF 8", /OF 8/.test(note), note);
check("quiz dots present", (await page.locator(".quiz-dot").count()) === 8,
  `dots=${await page.locator(".quiz-dot").count()}`);
// 20-second clock is visible and counting
check("timer bar present", (await page.locator("[data-quiz-timer]").count()) === 1);
const secText = await page.locator("[data-timer-sec]").innerText().catch(() => "");
check("timer shows seconds remaining", /^\d+$/.test(secText) && Number(secText) <= 20 && Number(secText) >= 1, `sec=${secText}`);

// hint works
await page.locator("[data-hint]").click();
await page.waitForTimeout(1200);
check("hint bubble appears", (await page.locator(".hint-bubble").count()) > 0);
await page.screenshot({ path: "/home/user/reload-quiz.png" });

// 2) answer an option -> feedback renders
await page.locator(".training-choice").first().click();
await page.waitForTimeout(1500);
check("feedback panel appears", (await page.locator(".feedback-inline").count()) > 0,
  await page.locator(".feedback-inline h2").innerText().catch(() => ""));

// 3) THE RELOAD — what crashed in the user's screenshot
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => {
  const s = document.querySelector("[data-stage]");
  return s && (s.querySelector(".training-choice") || s.querySelector(".feedback-inline") || s.querySelector(".training-error:not([hidden])"));
}, { timeout: 15000 });
await page.waitForTimeout(500);
check("AFTER RELOAD: quiz or feedback re-rendered",
  (await page.locator(".training-choice").count() > 0) ||
  (await page.locator(".feedback-inline").count() > 0),
  `choices=${await page.locator(".training-choice").count()} feedback=${await page.locator(".feedback-inline").count()}`);
check("AFTER RELOAD: no error box", !(await page.locator(".training-error").isVisible().catch(() => false)),
  await page.locator("[data-error-text]").isVisible().catch(() => false) ? await page.locator("[data-error-text]").innerText() : "");
await page.screenshot({ path: "/home/user/reload-after.png" });

console.log("\nconsole/page errors:");
for (const l of logs) console.log("  " + l);
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
