import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import supertest from "supertest";

const testDir = await mkdtemp(path.join(os.tmpdir(), "zi-promo-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "false";
process.env.DATA_DIR = testDir;
process.env.BOOTSTRAP_ADMIN_USERNAME = "test.admin";
process.env.BOOTSTRAP_ADMIN_PASSWORD = "TestAdmin!2026";
process.env.SESSION_SECRET = "promotion-test-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import(
  "../server/db.js"
);
const { seedDatabase } = await import("../server/seed.js");
const { createApp } = await import("../server/app.js");
const { User, Trainer, Module, Progress } = await import("../server/models.js");
const { hashPassword } = await import("../server/passwords.js");

function client(app) {
  const agent = supertest.agent(app);
  let csrf;
  return {
    agent,
    get csrfToken() {
      return csrf;
    },
    async init() {
      const r = await agent.get("/api/session").expect(200);
      csrf = r.body.csrfToken;
      return r;
    },
    async login(username, password, status = 200) {
      const r = await agent
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ username, password })
        .expect(status);
      if (r.body.csrfToken) csrf = r.body.csrfToken;
      return r;
    },
    get: (url) => agent.get(`/api${url}`),
    post: (url, body) =>
      agent.post(`/api${url}`).set("X-CSRF-Token", csrf).send(body),
    patch: (url, body) =>
      agent.patch(`/api${url}`).set("X-CSRF-Token", csrf).send(body),
    delete: (url, body) =>
      agent.delete(`/api${url}`).set("X-CSRF-Token", csrf).send(body),
  };
}
async function makeEmployee(username, scores) {
  const base = username.split(".")[0];
  const user = await User.create({
    firstName: base[0].toUpperCase() + base.slice(1),
    lastName: "Test",
    age: 25,
    username,
    passwordHash: await hashPassword("Welcome!2026"),
    role: "employee",
    mustChangePassword: false,
    status: "active",
  });
  for (const [key, score] of Object.entries(scores))
    await Progress.create({
      employeeId: user._id,
      moduleKey: key,
      score,
      attempts: 1,
      assessedAt: new Date(),
      source: "assessment",
    });
  return user;
}

test("Roles and promotion: reports, trainer and admin applications", {
  timeout: 120000,
}, async (t) => {
  const uri = await connectDatabase({ isolated: true });
  await seedDatabase();
  const app = await createApp(uri);
  t.after(async () => {
    await app.locals.sessionStore.close();
    await disconnectDatabase();
    await rm(testDir, { recursive: true, force: true });
  });

  const admin = client(app);
  await admin.init();
  await admin.login("test.admin", "TestAdmin!2026");
  await admin
    .post("/auth/first-password", {
      newPassword: "AdminPrivate!2026",
      confirmPassword: "AdminPrivate!2026",
    })
    .expect(200);
  await admin.init();
  await admin.login("test.admin", "AdminPrivate!2026");

  // A trainer with a linked account the administrator provides.
  const trainerAccount = await User.create({
    firstName: "Guide",
    lastName: "Team",
    age: 30,
    username: "guide.team",
    passwordHash: await hashPassword("TrainerPw!2026"),
    role: "trainer",
    mustChangePassword: false,
    status: "active",
  });
  const trainer = await Trainer.create({
    firstName: "Guide",
    lastName: "Team",
    nickname: "Guido",
    nicknameKey: "guido",
    imageUrl: "/assets/yeti-trainer.png",
    status: "active",
    userId: trainerAccount._id,
    permissions: { viewProgress: true, resetPassword: true },
  });
  await Module.updateOne(
    { key: "manual-handling" },
    { $set: { trainerId: trainer._id } },
  );

  const rater = await makeEmployee("star.rater", { "manual-handling": 80 });
  const lowScore = await makeEmployee("low.score", {
    "manual-handling": 50,
    "working-at-height": 40,
    "hazard-perception": 55,
  });
  const topScore = await makeEmployee("top.score", {
    "manual-handling": 95,
    "working-at-height": 92,
    "hazard-perception": 90,
  });
  const secondElite = await makeEmployee("second.elite", {
    "manual-handling": 91,
    "working-at-height": 90,
    "hazard-perception": 92,
  });

  const raterClient = client(app);
  await raterClient.init();
  await raterClient.login("star.rater", "Welcome!2026");
  const lowClient = client(app);
  await lowClient.init();
  await lowClient.login("low.score", "Welcome!2026");
  const topClient = client(app);
  await topClient.init();
  await topClient.login("top.score", "Welcome!2026");
  const secondClient = client(app);
  await secondClient.init();
  await secondClient.login("second.elite", "Welcome!2026");
  const trainerClient = client(app);
  await trainerClient.init();
  await trainerClient.login("guide.team", "TrainerPw!2026");

  await t.test("the star-rating endpoint is retired", async () => {
    await raterClient
      .post("/ratings", {
        moduleKey: "manual-handling",
        trainerId: String(trainer._id),
        stars: 5,
      })
      .expect(404);
    // No rating payloads leak into the employee or trainer payloads.
    const training = await raterClient.get("/me/training").expect(200);
    assert.equal(training.body.myRatings, undefined);
    assert.equal(training.body.ratedModules, undefined);
    const me = await trainerClient.get("/trainer/me").expect(200);
    assert.equal(me.body.trainer.ratings, undefined);
    // Completion percentages are present instead.
    assert.deepEqual(Object.keys(training.body.modulePercents).length, 3);
    assert.equal(training.body.modulePercents["manual-handling"], 100); // passed
    assert.equal(typeof me.body.adminEligibility.daysActive, "number");
    assert.equal(typeof me.body.adminEligibility.certified, "number");
  });

  await t.test("employees can report a trainer and the admin resolves it", async () => {
    // Validation: a message is required.
    await raterClient
      .post("/me/trainer-reports", {
        trainerId: String(trainer._id),
        moduleKey: "manual-handling",
        message: "  ",
      })
      .expect(422);
    // The trainer must be the guide of the selected module.
    await raterClient
      .post("/me/trainer-reports", {
        trainerId: String(trainer._id),
        moduleKey: "hazard-perception",
        message: "Wrong module attached.",
      })
      .expect(409);
    const created = await raterClient
      .post("/me/trainer-reports", {
        trainerId: String(trainer._id),
        moduleKey: "manual-handling",
        message: "I waited a long time for help on the practical activity.",
      })
      .expect(201);
    assert.ok(created.body.report);
    // The employee can see their own report as open.
    const own = await raterClient.get("/me/trainer-reports").expect(200);
    assert.equal(own.body.reports.length, 1);
    assert.equal(own.body.reports[0].status, "open");
    assert.equal(own.body.reports[0].trainer, "Guido");
    // The administrator sees it and can resolve it.
    const adminView = await admin.get("/admin/trainer-reports").expect(200);
    const target = adminView.body.reports.find(
      (r) => r.employee.username === "star.rater",
    );
    assert.ok(target);
    assert.ok(adminView.body.open >= 1);
    await admin
      .post(`/admin/trainer-reports/${target.id}/resolve`, {})
      .expect(200);
    const after = await raterClient.get("/me/trainer-reports").expect(200);
    assert.equal(after.body.reports[0].status, "resolved");
    // Resolving twice is rejected.
    await admin
      .post(`/admin/trainer-reports/${target.id}/resolve`, {})
      .expect(409);
    // The overview exposes the open-report count.
    const overview = await admin.get("/admin/overview").expect(200);
    assert.equal(typeof overview.body.stats.openTrainerReports, "number");
  });

  await t.test("employees need 90+ in every module to apply as trainer", async () => {
    await lowClient
      .post("/me/apply-trainer", { message: "Please let me in." })
      .expect(409);
    const top = await topClient
      .post("/me/apply-trainer", { message: "I'm ready to guide others." })
      .expect(201);
    assert.ok(top.body.application);
    // A pending application cannot be duplicated.
    await topClient
      .post("/me/apply-trainer", { message: "Again?" })
      .expect(409);
    const second = await secondClient
      .post("/me/apply-trainer", { message: "" })
      .expect(201);
    assert.ok(second.body.application);
    const training = await lowClient.get("/me/training").expect(200);
    assert.equal(training.body.trainerEligible, false);
    const topTraining = await topClient.get("/me/training").expect(200);
    assert.equal(topTraining.body.trainerEligible, true);
    assert.equal(topTraining.body.trainerApplication.status, "pending");
  });

  await t.test("approval promotes the employee to trainer with a linked account", async () => {
    const apps = await admin.get("/admin/applications").expect(200);
    const pendingTrainer = apps.body.applications.find(
      (a) => a.type === "trainer" && a.applicant.username === "top.score",
    );
    assert.ok(pendingTrainer);
    assert.equal(pendingTrainer.scores.find((s) => s.key === "hazard-perception").score, 90);
    const overview = await admin.get("/admin/overview").expect(200);
    assert.ok(overview.body.stats.pendingApplications >= 2);
    await admin.post(`/admin/applications/${pendingTrainer.id}/approve`, {}).expect(200);
    const promoted = await User.findOne({ username: "top.score" }).lean();
    assert.equal(promoted.role, "trainer");
    const profile = await Trainer.findOne({ userId: promoted._id }).lean();
    assert.ok(profile);
    assert.equal(profile.permissions.viewProgress, true);
    assert.equal(profile.permissions.resetPassword, true);
    // Approving twice is rejected.
    await admin
      .post(`/admin/applications/${pendingTrainer.id}/approve`, {})
      .expect(404);
    // The promoted employee keeps their existing credentials and lands in the trainer workspace.
    const promotedClient = client(app);
    await promotedClient.init();
    await promotedClient.login("top.score", "Welcome!2026");
    const me = await promotedClient.get("/trainer/me").expect(200);
    assert.equal(me.body.trainer.nickname, "Top");
    const employees = await promotedClient.get("/trainer/employees").expect(200);
    assert.ok(employees.body.employees.length >= 4);
    // Completion percentages travel with every roster row.
    const row = employees.body.employees.find((e) => e.username === "top.score");
    assert.equal(row.overallPercent, 100);
    assert.equal(row.modulePercents["manual-handling"], 100);
    const started = employees.body.employees.find((e) => e.username === "low.score");
    assert.equal(started.overallPercent, 0);
    // Trainer cannot delete employee IDs.
    const target = employees.body.employees.find((e) => e.username === "star.rater");
    await promotedClient
      .delete(`/admin/employees/${target.id}`, { confirmation: "star.rater" })
      .expect(403);
  });

  await t.test("rejection keeps the applicant an employee and allows reapplying", async () => {
    const apps = await admin.get("/admin/applications").expect(200);
    const pending = apps.body.applications.find(
      (a) => a.type === "trainer" && a.applicant.username === "second.elite" && a.status === "pending",
    );
    assert.ok(pending);
    await admin.post(`/admin/applications/${pending.id}/reject`, {}).expect(200);
    const applicant = await User.findOne({ username: "second.elite" }).lean();
    assert.equal(applicant.role, "employee");
    assert.equal(await Trainer.exists({ userId: applicant._id }), null);
    await secondClient
      .post("/me/apply-trainer", { message: "One more chance." })
      .expect(201);
  });

  await t.test("trainer -> admin needs tenure plus certified employees", async () => {
    const promotedClient = client(app);
    await promotedClient.init();
    await promotedClient.login("top.score", "Welcome!2026");
    const profileOf = async () =>
      Trainer.findOne({ userId: (await User.findOne({ username: "top.score" }).lean())._id });
    // Fresh profile: no tenure, no certified employees -> not eligible.
    await promotedClient
      .post("/trainer/apply-admin", { message: "" })
      .expect(409);
    let profile = await profileOf();
    // Tenure alone is not enough.
    // createdAt is immutable through Mongoose updates; the raw collection
    // call backdates the profile exactly like a long-running deployment.
    await Trainer.collection.updateOne(
      { _id: profile._id },
      { $set: { createdAt: new Date(Date.now() - 120 * 86400000) } },
    );
    await promotedClient
      .post("/trainer/apply-admin", { message: "Tenure only." })
      .expect(409);
    // Certified employees alone are not enough (short tenure).
    await Module.updateOne(
      { key: "manual-handling" },
      { $set: { trainerId: profile._id } },
    );
    for (let i = 0; i < 5; i++) {
      await makeEmployee(`certified.${i}`, {
        "manual-handling": 80,
        "working-at-height": 80,
        "hazard-perception": 80,
      });
    }
    await Trainer.collection.updateOne(
      { _id: profile._id },
      { $set: { createdAt: new Date() } },
    );
    await promotedClient
      .post("/trainer/apply-admin", { message: "Certified only." })
      .expect(409);
    // Both conditions met -> the application goes through.
    // createdAt is immutable through Mongoose updates; the raw collection
    // call backdates the profile exactly like a long-running deployment.
    await Trainer.collection.updateOne(
      { _id: profile._id },
      { $set: { createdAt: new Date(Date.now() - 120 * 86400000) } },
    );
    const me = await promotedClient.get("/trainer/me").expect(200);
    assert.equal(me.body.adminEligibility.eligible, true);
    assert.ok(me.body.adminEligibility.certified >= 5); // 5 created + seeded Anisha
    assert.ok(me.body.adminEligibility.daysActive >= 90);
    await promotedClient
      .post("/trainer/apply-admin", { message: "Tenure and track record." })
      .expect(201);
    await promotedClient
      .post("/trainer/apply-admin", { message: "double" })
      .expect(409);
    const apps = await admin.get("/admin/applications").expect(200);
    const adminApp = apps.body.applications.find(
      (a) => a.type === "admin" && a.applicant.username === "top.score" && a.status === "pending",
    );
    assert.ok(adminApp);
    assert.ok(adminApp.trainer.eligibility.certified >= 5);
    await admin.post(`/admin/applications/${adminApp.id}/approve`, {}).expect(200);
    const nowAdmin = await User.findOne({ username: "top.score" }).lean();
    assert.equal(nowAdmin.role, "admin");
    // Two administrators now exist and the new one can use the console.
    assert.equal(
      (await User.countDocuments({ role: "admin", status: "active" })),
      2,
    );
    const newAdmin = client(app);
    await newAdmin.init();
    await newAdmin.login("top.score", "Welcome!2026");
    const overview = await newAdmin.get("/admin/overview").expect(200);
    assert.ok(overview.body.stats);
    // Approval to admin keeps the trainer profile (module guides remain intact).
    assert.ok(await Trainer.exists({ userId: nowAdmin._id }));
  });
});
