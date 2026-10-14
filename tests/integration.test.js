import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import supertest from "supertest";
import sharp from "sharp";

const testDir = await mkdtemp(path.join(os.tmpdir(), "zi-test-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "false";
process.env.DATA_DIR = testDir;
process.env.BOOTSTRAP_ADMIN_USERNAME = "test.admin";
process.env.BOOTSTRAP_ADMIN_PASSWORD = "TestAdmin!2026";
process.env.SESSION_SECRET = "integration-test-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { seedDatabase } = await import("../server/seed.js");
const { createApp } = await import("../server/app.js");
const { User, Progress, Module, progressSummary } =
  await import("../server/models.js");
const { verifyPassword } = await import("../server/passwords.js");

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
    upload: (url, buffer, filename = "guide.png") =>
      agent
        .post(`/api${url}`)
        .set("X-CSRF-Token", csrf)
        .field("firstName", "Test")
        .field("lastName", "Guide")
        .field("nickname", "Scout")
        .field("status", "active")
        .field("username", "scout.training")
        .field("temporaryPassword", "Welcome!2026")
        .field("confirmPassword", "Welcome!2026")
        .field("permissions", JSON.stringify({ viewProgress: true, resetPassword: true }))
        .field("moduleKeys", JSON.stringify(["manual-handling"]))
        .attach("image", buffer, filename),
  };
}

test(
  "Zero Incident: secure account lifecycle, virtual trainers and progress",
  { timeout: 120000 },
  async (t) => {
    const uri = await connectDatabase({ isolated: true });
    await seedDatabase();
    const app = await createApp(uri);
    t.after(async () => {
      await app.locals.sessionStore.close();
      await disconnectDatabase();
      await rm(testDir, { recursive: true, force: true });
    });
    const admin = client(app);
    const employee = client(app);
    const oldEmployeeSession = client(app);
    let employeeId, trainerId;
    const employeeInput = {
      firstName: "Asha",
      lastName: "Rai",
      age: 26,
      username: "asha.rai",
      employeeNumber: "",
      temporaryPassword: "Welcome!2026",
      confirmPassword: "Welcome!2026",
      status: "active",
      role: "admin",
      mustChangePassword: false,
    };

    await t.test(
      "API authorization, CSRF and secret-file protection",
      async () => {
        await supertest(app).get("/api/admin/overview").expect(401);
        await supertest(app).get("/.env").expect(404);
        await supertest(app).get("/server/config.js").expect(404);
        await admin.init();
        await admin.agent
          .post("/api/auth/login")
          .send({ username: "test.admin", password: "TestAdmin!2026" })
          .expect(403);
        await admin.login("test.admin", "Incorrect!2026", 401);
        const result = await admin.login("test.admin", "TestAdmin!2026");
        assert.equal(result.body.user.mustChangePassword, true);
        assert.equal(result.body.user.passwordHash, undefined);
        const blocked = await admin.get("/admin/overview").expect(403);
        assert.equal(blocked.body.code, "PASSWORD_CHANGE_REQUIRED");
        await admin
          .post("/auth/first-password", {
            newPassword: "AdminPrivate!2026",
            confirmPassword: "AdminPrivate!2026",
          })
          .expect(200);
        await admin.get("/admin/overview").expect(401);
        await admin.init();
        await admin.login("test.admin", "AdminPrivate!2026");
        await admin.get("/admin/overview").expect(200);
      },
    );
    await t.test(
      "development iframe cookies are secure, partitioned and cross-site capable",
      async () => {
        const result = await supertest(app)
          .get("/api/session")
          .set("X-Forwarded-Proto", "https")
          .expect(200);
        const cookie = result.headers["set-cookie"][0];
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /Secure/);
        assert.match(cookie, /SameSite=None/);
        assert.match(cookie, /Partitioned/);
      },
    );
    await t.test(
      "employee creation validates identity and stores only a salted hash",
      async () => {
        await admin
          .post("/admin/employees", { ...employeeInput, age: 15 })
          .expect(422);
        await admin
          .post("/admin/employees", {
            ...employeeInput,
            confirmPassword: "NoMatch!2026",
          })
          .expect(422);
        const result = await admin
          .post("/admin/employees", employeeInput)
          .expect(201);
        const e = result.body.employee;
        employeeId = e.id;
        assert.equal(e.role, "employee");
        assert.equal(e.mustChangePassword, true);
        assert.match(e.employeeNumber, /^ZI-\d{4}-\d+$/);
        assert.equal(e.passwordHash, undefined);
        const stored = await User.findById(employeeId).select("+passwordHash");
        assert.notEqual(stored.passwordHash, employeeInput.temporaryPassword);
        assert.match(stored.passwordHash, /^scrypt\$32768\$8\$3\$/);
        assert.equal(
          await verifyPassword(
            employeeInput.temporaryPassword,
            stored.passwordHash,
          ),
          true,
        );
        await admin.post("/admin/employees", employeeInput).expect(409);
        const found = await admin
          .get("/admin/employees?search=asha&status=active")
          .expect(200);
        assert.equal(found.body.total, 1);
        await admin.get("/admin/employees/not-an-id").expect(404);
      },
    );
    await t.test(
      "mandatory first-login password change cannot be bypassed",
      async () => {
        await employee.init();
        await employee.login("asha.rai", "Welcome!2026");
        await oldEmployeeSession.init();
        await oldEmployeeSession.login("asha.rai", "Welcome!2026");
        await employee.get("/me/training").expect(403);
        await employee.get("/admin/overview").expect(403);
        await employee
          .post("/auth/first-password", {
            newPassword: "Welcome!2026",
            confirmPassword: "Welcome!2026",
          })
          .expect(422);
        await employee
          .post("/auth/first-password", {
            newPassword: "MyPrivate!2026",
            confirmPassword: "MyPrivate!2026",
          })
          .expect(200);
        await oldEmployeeSession.get("/me/training").expect(401);
        await employee.get("/me/training").expect(401);
        await employee.init();
        await employee.login("asha.rai", "Welcome!2026", 401);
        await employee.login("asha.rai", "MyPrivate!2026");
        const response = await employee.get("/me/training").expect(200);
        assert.equal(response.body.modules.length, 3);
        assert.equal(response.body.progress.eligible, false);
        assert.equal(response.body.progress.overallScore, null);
        assert.equal(response.body.progress.assessed, 0);
        assert.equal(
          response.body.modules.every(
            (m) =>
              m.assessmentAvailable ===
              [
                "manual-handling",
                "working-at-height",
                "hazard-perception",
              ].includes(m.key),
          ),
          true,
        );
      },
    );
    await t.test(
      "employees cannot manage accounts or submit fabricated scores",
      async () => {
        const r = await employee.get("/admin/overview").expect(403);
        assert.equal(r.body.code, "FORBIDDEN");
        await employee.post("/admin/employees", employeeInput).expect(403);
        await employee.post("/me/training", { score: 100 }).expect(404);
      },
    );
    await t.test(
      "account edits and deactivation preserve data but revoke sessions",
      async () => {
        await admin
          .patch(`/admin/employees/${employeeId}`, {
            firstName: "Asha",
            lastName: "Gurung",
            age: 27,
            username: "asha.rai",
            status: "active",
          })
          .expect(200);
        await admin
          .patch(`/admin/employees/${employeeId}/status`, {
            status: "inactive",
          })
          .expect(200);
        await employee.get("/me/training").expect(401);
        await employee.init();
        await employee.login("asha.rai", "MyPrivate!2026", 401);
        await admin
          .patch(`/admin/employees/${employeeId}/status`, { status: "active" })
          .expect(200);
        await employee.login("asha.rai", "MyPrivate!2026");
        const e = await User.findById(employeeId);
        assert.equal(e.lastName, "Gurung");
      },
    );
    await t.test(
      "password resets revoke sessions and restore mandatory setup",
      async () => {
        await admin
          .post(`/admin/employees/${employeeId}/reset-password`, {
            temporaryPassword: "NewTemporary!2026",
            confirmPassword: "NewTemporary!2026",
          })
          .expect(200);
        await employee.get("/me/training").expect(401);
        await employee.init();
        await employee.login("asha.rai", "NewTemporary!2026");
        await employee.get("/me/training").expect(403);
        await employee
          .post("/auth/first-password", {
            newPassword: "AnotherPrivate!2026",
            confirmPassword: "AnotherPrivate!2026",
          })
          .expect(200);
        await employee.init();
        await employee.login("asha.rai", "AnotherPrivate!2026");
      },
    );
    await t.test(
      "trainer uploads are validated, re-encoded and assigned with admin-provided sign-in",
      async () => {
        await admin
          .upload(
            "/admin/trainers",
            Buffer.from("<script>alert(1)</script>"),
            "unsafe.png",
          )
          .expect(422);
        // Trainer creation now requires the sign-in the administrator provides.
        const imageOnly = await sharp({
          create: { width: 40, height: 40, channels: 3, background: "#ed3340" },
        })
          .png()
          .toBuffer();
        await admin
          .agent
          .post("/api/admin/trainers")
          .set("X-CSRF-Token", admin.csrfToken)
          .field("firstName", "Test")
          .field("lastName", "Guide")
          .field("nickname", "Scout")
          .attach("image", imageOnly, "missing-creds.png")
          .expect(422);
        const image = await sharp({
          create: { width: 40, height: 40, channels: 3, background: "#ed3340" },
        })
          .png()
          .toBuffer();
        const result = await admin.upload("/admin/trainers", image).expect(201);
        trainerId = result.body.trainer.id;
        assert.equal(result.body.trainer.passwordHash, undefined);
        assert.equal(result.body.trainer.username, undefined);
        assert.equal(result.body.trainer.accountUsername, "scout.training");
        assert.equal(result.body.trainer.hasAccount, true);
        assert.equal(result.body.trainer.accountMustChangePassword, true);
        assert.equal(result.body.trainer.permissions.viewProgress, true);
        assert.equal(result.body.trainer.permissions.resetPassword, true);
        assert.match(
          result.body.trainer.imageUrl,
          /^\/media\/trainers\/[a-f\d-]+\.webp$/,
        );
        // The trainer can sign in with the credentials the administrator set,
        // must change the password first, then reaches the trainer workspace.
        const trainerClient = client(app);
        await trainerClient.init();
        await trainerClient.login("scout.training", "Welcome!2026");
        assert.equal(
          (await trainerClient.get("/trainer/me")).body.code,
          "PASSWORD_CHANGE_REQUIRED",
        );
        await trainerClient
          .post("/auth/first-password", {
            newPassword: "ScoutPrivate!2026",
            confirmPassword: "ScoutPrivate!2026",
          })
          .expect(200);
        await trainerClient.init();
        await trainerClient.login("scout.training", "ScoutPrivate!2026");
        const trainerMe = await trainerClient.get("/trainer/me").expect(200);
        assert.equal(trainerMe.body.trainer.nickname, "Scout");
        assert.equal(trainerMe.body.trainer.accountUsername, "scout.training");
        assert.equal(trainerMe.body.canApplyAdmin, false);
        const progressBlocked = await admin
          .patch(`/admin/trainers/${trainerId}`, {
            firstName: "Test",
            lastName: "Guide",
            nickname: "Scout",
            status: "active",
            moduleKeys: JSON.stringify(["manual-handling"]),
            permissions: JSON.stringify({
              viewProgress: false,
              resetPassword: false,
            }),
          })
          .expect(200);
        assert.equal(
          progressBlocked.body.trainer.permissions.viewProgress,
          false,
        );
        await trainerClient
          .get("/trainer/employees")
          .expect(403)
          .expect((r) => assert.equal(r.body.code, "PERMISSION_DENIED"));
        // The administrator can reset the trainer's password.
        await admin
          .post(`/admin/trainers/${trainerId}/reset-password`, {
            temporaryPassword: "Welcome!2026",
            confirmPassword: "Welcome!2026",
          })
          .expect(200);
        await trainerClient.init();
        await trainerClient.login("scout.training", "Welcome!2026");
        await trainerClient
          .post("/auth/first-password", {
            newPassword: "ScoutPrivate!2026",
            confirmPassword: "ScoutPrivate!2026",
          })
          .expect(200);
        await trainerClient.init();
        await trainerClient.login("scout.training", "ScoutPrivate!2026");
        await admin
          .patch(`/admin/trainers/${trainerId}`, {
            firstName: "Test",
            lastName: "Guide",
            nickname: "Scout",
            status: "active",
            moduleKeys: JSON.stringify(["manual-handling"]),
            permissions: JSON.stringify({
              viewProgress: true,
              resetPassword: true,
            }),
          })
          .expect(200);
        await trainerClient.get("/trainer/employees").expect(200);
        const module = await Module.findOne({ key: "manual-handling" });
        assert.equal(String(module.trainerId), trainerId);
        const training = await employee.get("/me/training").expect(200);
        assert.equal(training.body.modules[0].trainer.nickname, "Scout");
        await employee.agent
          .get(result.body.trainer.imageUrl)
          .expect(200)
          .expect("Content-Type", /image\/webp/);
        await supertest(app).get(result.body.trainer.imageUrl).expect(401);
        await admin
          .patch(`/admin/trainers/${trainerId}/status`, { status: "inactive" })
          .expect(200);
        const hidden = await employee.get("/me/training").expect(200);
        assert.equal(hidden.body.modules[0].trainer, null);
        await admin
          .patch(`/admin/trainers/${trainerId}/status`, { status: "active" })
          .expect(200);
      },
    );
    await t.test(
      "certificate eligibility requires every module to pass, including boundary scores",
      async () => {
        const keys = [
          "manual-handling",
          "working-at-height",
          "hazard-perception",
        ];
        for (const [i, score] of [100, 100, 69].entries())
          await Progress.create({
            employeeId,
            moduleKey: keys[i],
            score,
            attempts: 1,
            source: "demo",
          });
        let data = (
          await admin.get(`/admin/employees/${employeeId}`).expect(200)
        ).body.progress;
        assert.equal(data.eligible, false);
        assert.equal(data.passed, 2);
        assert.equal(data.overallScore > 70, true);
        await Progress.updateOne(
          { employeeId, moduleKey: "hazard-perception" },
          { $set: { score: 70 } },
        );
        data = (await employee.get("/me/training").expect(200)).body.progress;
        assert.equal(data.eligible, true);
        assert.equal(data.passed, 3);
        assert.equal(data.modules[2].classification, "Pass");
        assert.equal(
          progressSummary([{ moduleKey: "manual-handling", score: 85 }])
            .modules[0].classification,
          "Excellent",
        );
        assert.equal(
          progressSummary([{ moduleKey: "manual-handling", score: 84 }])
            .modules[0].classification,
          "Pass",
        );
        await assert.rejects(
          Progress.create({
            employeeId,
            moduleKey: "manual-handling",
            score: 101,
          }),
        );
        await assert.rejects(
          Progress.create({
            employeeId,
            moduleKey: "manual-handling",
            score: -1,
          }),
        );
      },
    );
    await t.test(
      "password change verifies current credentials and signs out all sessions",
      async () => {
        await employee
          .post("/auth/change-password", {
            currentPassword: "Wrong!2026",
            newPassword: "FinalPrivate!2026",
            confirmPassword: "FinalPrivate!2026",
          })
          .expect(422);
        await employee
          .post("/auth/change-password", {
            currentPassword: "AnotherPrivate!2026",
            newPassword: "FinalPrivate!2026",
            confirmPassword: "FinalPrivate!2026",
          })
          .expect(200);
        await employee.get("/me/training").expect(401);
        await employee.init();
        await employee.login("asha.rai", "FinalPrivate!2026");
      },
    );
    await t.test(
      "explicit delete confirmations remove accounts, scores and trainer assignments",
      async () => {
        await admin
          .delete(`/admin/trainers/${trainerId}`, { confirmation: "wrong" })
          .expect(422);
        await admin
          .delete(`/admin/trainers/${trainerId}`, { confirmation: "Scout" })
          .expect(200);
        assert.equal(
          (await Module.findOne({ key: "manual-handling" })).trainerId,
          null,
        );
        await admin
          .delete(`/admin/employees/${employeeId}`, { confirmation: "wrong" })
          .expect(422);
        await admin
          .delete(`/admin/employees/${employeeId}`, {
            confirmation: "asha.rai",
          })
          .expect(200);
        await employee.get("/me/training").expect(401);
        assert.equal(await Progress.countDocuments({ employeeId }), 0);
        assert.equal(await User.findById(employeeId), null);
      },
    );
  },
);
