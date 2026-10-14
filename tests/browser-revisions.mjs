// Browser smoke test for the Oct 2026 client revisions.
// Usage: node tests/browser-revisions.mjs [baseUrl]
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://127.0.0.1:3210";
const errors = [];
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push("[pageerror] " + e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push("[console] " + m.text());
});

const results = [];
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} · ${name}${extra ? " · " + extra : ""}`);
  if (!ok) process.exitCode = 1;
};

async function login(username, password) {
  await page.goto(base + "/#/login");
  await page.waitForSelector("#login-form", { timeout: 15000 });
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click("#login-form button[type=submit]");
  await page.waitForTimeout(1500);
}
async function logout() {
  await page.click("[data-logout]");
  await page.waitForTimeout(900);
}

// ---------------------------------------------------------------- employee
await login("anisha.g", "DemoOnly!2026");
await page.goto(base + "/#/employee/progress");
await page.waitForSelector(".sidebar", { timeout: 15000 });
const sidebar = await page.textContent(".sidebar");
check("employee sidebar has no Rate trainer", !/Rate trainer/i.test(sidebar));
check("employee sidebar keeps hub/progress/certificates", /Training hub/.test(sidebar) && /My progress/.test(sidebar) && /Certificates/.test(sidebar));

await page.goto(base + "/#/employee/progress");
await page.waitForSelector(".detail-modules", { timeout: 15000 });
const percents = await page.$$eval(".detail-module .module-percent", (els) => els.map((e) => e.textContent.trim()));
check("progress page shows per-module percent", percents.length === 3, percents.join(","));

await page.goto(base + "/#/employee/module/manual-handling");
await page.waitForSelector(".module-progress-top", { timeout: 20000 });
const topPct = await page.textContent(".module-progress-top .module-percent");
check("module page shows top completion bar", /%/.test(topPct), topPct.trim());

// Help modal carries the relocated report flow.
await page.click(".sidebar [data-help]");
await page.waitForSelector(".modal", { timeout: 10000 });
const helpText = await page.textContent(".modal");
check("help modal contains Report a trainer", /Report a trainer/i.test(helpText));
await page.click(".modal [data-close-modal]");
await page.waitForTimeout(400);

// 3D Spot the Hazard.
await page.goto(base + "/#/employee/fun-games");
await page.waitForSelector("[data-game=hazard-hunt]", { timeout: 15000 });
await page.click("[data-game=hazard-hunt]");
await page.waitForSelector(".hh3d-host canvas", { timeout: 20000 });
await page.waitForFunction(() => window.__hh3d && window.__hh3d.count() === 6, null, { timeout: 15000 });
check("3D hazard hunt mounted with 6 hazards", true);
await page.click("[data-hh-start]");
await page.waitForTimeout(1300);
const timeAfterStart = await page.textContent("[data-hh-time]");
check("walk timer runs", Number(timeAfterStart) < 60, `t=${timeAfterStart}`);
const point = await page.evaluate(() => window.__hh3d.project(0));
await page.mouse.click(point.x, point.y);
await page.waitForTimeout(500);
const found = await page.textContent("[data-hh-found]");
check("clicking a hazard reports it", found.trim() === "1 / 6", found.trim());
const box = await page.$eval(".hh3d-host canvas", (c) => {
  const r = c.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + 30 };
});
await page.mouse.click(box.x, box.y);
await page.waitForTimeout(400);
const scoreAfterMiss = await page.textContent("[data-hh-score]");
check("wrong click costs 10", scoreAfterMiss.trim() === "90", scoreAfterMiss.trim());

// ---------------------------------------------------------------- trainer
await logout();
await login("yeti", "Welcome!2026");
await page.goto(base + "/#/trainer/overview");
await page.waitForSelector(".sidebar", { timeout: 15000 });
const tSidebar = await page.textContent(".sidebar");
check("trainer sidebar shows Promotion, not ratings", /Promotion/.test(tSidebar) && !/ratings/i.test(tSidebar));
await page.goto(base + "/#/trainer/promotion");
await page.waitForSelector('strong:has-text("active days as a trainer")', { timeout: 15000 });
const promo = await page.textContent(".workspace");
check("promotion page lists both conditions", /active days as a trainer/.test(promo) && /certified under your guidance/.test(promo));
check("promotion page has no star language", !/stars/i.test(promo));
await page.goto(base + "/#/trainer/employees");
await page.waitForSelector(".data-table", { timeout: 15000 });
const head = await page.textContent(".data-table thead");
check("trainer roster has Completed column", /Completed/.test(head));
const cellPct = await page.$$eval(".cell-percent", (els) => els.length);
check("trainer roster shows per-module percent", cellPct >= 3, `${cellPct} cells`);

// ---------------------------------------------------------------- admin
await logout();
await login("safety.admin", "ZeroIncident!2026");
await page.goto(base + "/#/admin/overview");
await page.waitForSelector(".sidebar", { timeout: 15000 });
await page.goto(base + "/#/admin/progress");
await page.waitForSelector(".data-table", { timeout: 15000 });
const adminHead = await page.textContent(".data-table thead");
check("admin progress has Completed column", /Completed/.test(adminHead));
await page.goto(base + "/#/admin/applications");
await page.waitForSelector('th:has-text("Requirements")', { timeout: 15000 });
const appHead = await page.textContent(".workspace");
check("admin applications use Requirements, not stars", /Requirements/.test(appHead) && !/25 or more stars/.test(appHead));

console.log(results.join("\n"));
console.log("console/page errors:", errors.length ? errors : "none");
if (errors.length) process.exitCode = 1;
await browser.close();
