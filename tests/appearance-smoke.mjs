// Regression checks for visible logout, short viewports and remembered themes.
// Uses its own disposable database; never touches the running demo's records.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmp = await mkdtemp(path.join(os.tmpdir(), "zi-appearance-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "true";
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = "appearance-tests-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");
const { seedDatabase } = await import("../server/seed.js");
const { ROOT } = await import("../server/config.js");
const artifacts = path.join(ROOT, "data", "appearance-artifacts");
await mkdir(artifacts, { recursive: true });
const uri = await connectDatabase({ isolated: true });
await seedDatabase();
const app = await createApp(uri);
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
async function newPage(viewport = { width: 1280, height: 590 }, context) {
  context ||= await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
async function login(
  page,
  username = "safety.admin",
  password = "ZeroIncident!2026",
) {
  await page.goto(base);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator(".login-submit").click();
  // Admins/trainers land on the workspace shell; employees land on the
  // standalone 360° lobby (game-hub), which has no workspace chrome.
  await expect(page.locator(".workspace, .game-hub")).toBeVisible();
}
// Screenshots are diagnostic artifacts, not assertions — headless GPU
// full-page captures can flake, so capture is best-effort (one retry).
async function shot(page, name) {
  const file = path.join(artifacts, name);
  try {
    await page.screenshot({ path: file, fullPage: true });
  } catch {
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  }
}
async function assertNoOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
}
try {
  const page = await newPage();
  await login(page);
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("[data-topbar-logout]")).toBeInViewport({
    ratio: 1,
  });
  await expect(page.locator(".sidebar-profile [data-logout]")).toBeInViewport({
    ratio: 1,
  });
  await assertNoOverflow(page);
  await shot(page, "dark-short-laptop.png");
  console.log(
    "PASS: header and sidebar sign-out buttons fully visible at 1280 × 590.",
  );

  await page
    .getByRole("link", { name: "Register employee", exact: true })
    .click();
  await page.locator("#firstName").fill("Unsaved form input");
  await page.evaluate(() => window.scrollTo(0, 450));
  await expect(page.locator("[data-topbar-logout]")).toBeInViewport({
    ratio: 1,
  });
  const scrollBefore = await page.evaluate(() => scrollY);
  await page
    .getByRole("button", { name: "Switch to light theme", exact: true })
    .click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#firstName")).toHaveValue("Unsaved form input");
  assert.equal(await page.evaluate(() => scrollY), scrollBefore);
  assert.equal(
    await page
      .locator(".form-panel")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(255, 255, 255)",
  );
  console.log(
    "PASS: theme changes instantly without discarding form input or resetting scroll; header stays visible while scrolling.",
  );

  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("[data-theme-toggle]")).toHaveAttribute(
    "aria-label",
    "Switch to dark theme",
  );
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.screenshot({
    path: path.join(artifacts, "light-overview.png"),
    fullPage: true,
  });
  const sibling = await newPage(undefined, page.context());
  await sibling.goto(base + "/#/admin/overview");
  await expect(sibling.locator("body")).toHaveAttribute("data-theme", "light");
  await page.locator("[data-theme-toggle]").click();
  await expect(sibling.locator("body")).toHaveAttribute("data-theme", "dark");
  await page.locator("[data-theme-toggle]").click();
  await expect(sibling.locator("body")).toHaveAttribute("data-theme", "light");
  await sibling.close();
  console.log("PASS: theme survives reload and synchronizes across tabs.");

  for (const [link, ready] of [
    ["Manage employees", "#employee-results"],
    ["Virtual trainers", "#trainer-results"],
    ["Learning progress", "#progress-results"],
    ["Settings", "#profile-form"],
  ]) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(page.locator(ready)).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
    await assertNoOverflow(page);
  }
  await page
    .getByRole("link", { name: "Manage employees", exact: true })
    .click();
  await page.locator("[data-detail]").first().click();
  await expect(page.locator(".modal")).toBeVisible();
  assert.equal(
    await page
      .locator(".modal")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(255, 255, 255)",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  console.log(
    "PASS: light theme applies across admin pages, forms, status badges and dialogs.",
  );

  let logoutRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/logout")) logoutRequests++;
  });
  await page.evaluate(() => {
    const button = document.querySelector("[data-topbar-logout]");
    button.click();
    button.click();
  });
  await expect(page.locator("#login-form")).toBeVisible();
  assert.equal(logoutRequests, 1);
  const session = await page.request.get(base + "/api/session");
  assert.equal((await session.json()).user, null);
  assert.equal(
    (await page.request.get(base + "/api/admin/overview")).status(),
    401,
  );
  await page.goto(base + "/#/admin/overview");
  await expect(page.locator("#login-form")).toBeVisible();
  console.log(
    "PASS: sign-out destroys the server session, blocks protected APIs and ignores duplicate clicks.",
  );

  await login(page, "anisha.g", "DemoOnly!2026");
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  // The 360° lobby is standalone (no top bar chrome), so exercise the
  // theme toggle on a workspace page instead.
  await page.goto(`${base}/#/employee/progress`);
  await expect(page.locator(".workspace")).toBeVisible();
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      page
        .locator("[data-theme-toggle]")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe("rgb(25, 26, 30)");
  await shot(page, "employee-dark.png");
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
  await page.locator(".sidebar [data-help]").click();
  assert.equal(
    await page
      .locator(".modal")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(25, 26, 30)",
  );
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.locator(".sidebar-profile [data-logout]").click();
  await expect(page.locator("#login-form")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "login");
  await login(page);
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  console.log(
    "PASS: employee dark mode works; admin/employee preferences stay separate; the login page stays light.",
  );

  // Simulate another tab signing in, which rotates this tab's older CSRF token.
  const tokenResponse = await page.request.get(base + "/api/session");
  const csrf = (await tokenResponse.json()).csrfToken;
  const rotated = await page.request.post(base + "/api/auth/login", {
    headers: { "X-CSRF-Token": csrf },
    data: { username: "safety.admin", password: "ZeroIncident!2026" },
  });
  assert.equal(rotated.status(), 200);
  await page.locator("[data-topbar-logout]").click();
  await expect(page.locator("#login-form")).toBeVisible();
  assert.equal(
    (await page.request.get(base + "/api/admin/overview")).status(),
    401,
  );
  console.log(
    "PASS: sign-out safely refreshes an out-of-date CSRF token and still destroys the session.",
  );

  for (const viewport of [
    { width: 390, height: 590 },
    { width: 320, height: 480 },
    { width: 844, height: 360 },
  ]) {
    const small = await newPage(viewport);
    await login(small);
    await expect(small.locator("[data-topbar-logout]")).toBeInViewport({
      ratio: 1,
    });
    await expect(small.locator("[data-theme-toggle]")).toBeInViewport({
      ratio: 1,
    });
    await assertNoOverflow(small);
    await small.locator("[data-theme-toggle]").click();
    await expect(small.locator("body")).toHaveAttribute("data-theme", "light");
    if (viewport.width <= 760) {
      await expect(small.locator(".sidebar")).toHaveAttribute("inert", "");
      await small.locator("[data-sidebar-open]").click();
      await expect(small.locator("[data-sidebar-open]")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(
        small.locator(".sidebar-profile [data-logout]"),
      ).toBeInViewport({ ratio: 1 });
      await expect(small.locator(".sidebar")).toBeInViewport({ ratio: 1 });
      await shot(small, `mobile-menu-${viewport.width}.png`);
      await small.keyboard.press("Escape");
      await expect(small.locator(".sidebar")).toHaveAttribute("inert", "");
    } else {
      await expect(
        small.locator(".sidebar-profile [data-logout]"),
      ).toBeInViewport({ ratio: 1 });
      await expect(small.locator(".sidebar")).toBeInViewport({ ratio: 1 });
      await shot(small, "short-landscape.png");
    }
    await small.locator("[data-topbar-logout]").click();
    await expect(small.locator("#login-form")).toBeVisible();
    await small.context().close();
  }
  console.log(
    "PASS: mobile and short-landscape viewports keep controls reachable, have no horizontal page overflow and can sign out.",
  );

  const restricted = await newPage();
  await restricted.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage disabled for regression test");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage disabled for regression test");
    };
  });
  await login(restricted);
  await restricted.locator("[data-theme-toggle]").click();
  await expect(restricted.locator("body")).toHaveAttribute(
    "data-theme",
    "light",
  );
  await restricted
    .getByRole("link", { name: "Manage employees", exact: true })
    .click();
  await expect(restricted.locator("body")).toHaveAttribute(
    "data-theme",
    "light",
  );
  await restricted.locator("[data-topbar-logout]").click();
  await expect(restricted.locator("#login-form")).toBeVisible();
  console.log(
    "PASS: restricted local storage does not break theme switching, navigation or sign-out.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "ALL APPEARANCE AND LOGOUT CHECKS PASSED. No uncaught browser errors.",
  );
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
  await new Promise((resolve) => server.close(resolve));
  await app.locals.sessionStore.close();
  await disconnectDatabase();
  await rm(tmp, { recursive: true, force: true });
}
