import test from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const tmp = await mkdtemp(path.join(os.tmpdir(), "zi-certificate-api-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "true";
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = "certificate-tests-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");
const { seedDatabase } = await import("../server/seed.js");
const { User, Progress, Audit } = await import("../server/models.js");
const { TrainingAttempt } = await import("../server/training-models.js");
const { Certificate } = await import("../server/certificate-model.js");
const { verifyCompletedAttempt } = await import("../server/completion.js");
const { hashPassword } = await import("../server/passwords.js");
const { finishModule, issueBody } = await import("./certificate-fixtures.mjs");
const artifacts = path.resolve("data/certificate-artifacts");
await mkdir(artifacts, { recursive: true });
function client(app) {
  const agent = supertest.agent(app);
  let csrf;
  const c = {
    agent,
    async login(username, password = "Certificate!2026") {
      csrf = (await agent.get("/api/session").expect(200)).body.csrfToken;
      const r = await agent
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ username, password })
        .expect(200);
      csrf = r.body.csrfToken;
    },
    get: (u) => agent.get("/api" + u),
    post: (u, b) =>
      agent
        .post("/api" + u)
        .set("X-CSRF-Token", csrf)
        .send(b),
    patch: (u, b) =>
      agent
        .patch("/api" + u)
        .set("X-CSRF-Token", csrf)
        .send(b),
    delete: (u, b) =>
      agent
        .delete("/api" + u)
        .set("X-CSRF-Token", csrf)
        .send(b),
  };
  c.finish = (key, options) =>
    finishModule(
      async (u) => (await c.get(u).expect(200)).body,
      async (u, b) => (await c.post(u, b).expect(200)).body,
      key,
      options,
    );
  return c;
}
test(
  "Verified completion and immutable PDF certificate flow",
  { timeout: 180000 },
  async (t) => {
    const uri = await connectDatabase({ isolated: true });
    await seedDatabase();
    const app = await createApp(uri);
    t.after(async () => {
      await app.locals.sessionStore.close();
      await disconnectDatabase();
      await rm(tmp, { recursive: true, force: true });
    });
    const hash = await hashPassword("Certificate!2026");
    const learnerUser = await User.create({
      firstName: "Nima",
      lastName: "Rai",
      age: 25,
      employeeNumber: "ZI-2026-2001",
      username: "cert.learner",
      role: "employee",
      passwordHash: hash,
      mustChangePassword: false,
    });
    const otherUser = await User.create({
      firstName: "Other",
      lastName: "Learner",
      age: 25,
      employeeNumber: "ZI-2026-2002",
      username: "cert.other",
      role: "employee",
      passwordHash: hash,
      mustChangePassword: false,
    });
    const unicodeUser = await User.create({
      firstName: "आशा",
      lastName: "Rai",
      age: 27,
      employeeNumber: "ZI-2026-2003",
      username: "cert.unicode",
      role: "employee",
      passwordHash: hash,
      mustChangePassword: false,
    });
    const learner = client(app),
      other = client(app),
      admin = client(app),
      pending = client(app),
      demo = client(app),
      unicode = client(app);
    await learner.login("cert.learner");
    await other.login("cert.other");
    await admin.login("safety.admin", "ZeroIncident!2026");
    await pending.login("ramesh.s", "Welcome!2026");
    await demo.login("anisha.g", "DemoOnly!2026");
    await unicode.login("cert.unicode");
    let initialRecord, ready;
    await t.test(
      "anonymous, admin-as-employee, pending-password and CSRF guards",
      async () => {
        await supertest(app).get("/api/me/certificate").expect(401);
        await supertest(app).get("/api/me/certificate/pdf").expect(401);
        await admin.get("/me/certificate").expect(403);
        await pending.get("/me/certificate").expect(403);
        await learner.get("/admin/certificates").expect(403);
        await learner
          .get(`/admin/employees/${otherUser._id}/certificate/pdf`)
          .expect(403);
        await learner.agent.post("/api/me/certificate").send({}).expect(403);
        await learner.get("/me/certificate/pdf").expect(409);
        await learner
          .get("/server/assets/certificate-fonts/NotoSans-Regular.ttf")
          .expect(404);
      },
    );
    await t.test(
      "sample scores and fabricated Progress totals cannot unlock issuance",
      async () => {
        const status = (await demo.get("/me/certificate").expect(200)).body;
        assert.equal(status.eligible, false);
        assert.equal(status.passed, 0);
        assert.equal(status.certificate, null);
        await demo.post("/me/certificate", issueBody(status)).expect(409);
        for (const key of [
          "manual-handling",
          "working-at-height",
          "hazard-perception",
        ])
          await Progress.create({
            employeeId: otherUser._id,
            moduleKey: key,
            score: 100,
            source: "assessment",
            bestAttemptId: learnerUser._id,
          });
        const forged = (await other.get("/me/certificate")).body;
        assert.equal(forged.eligible, false);
        assert.equal(forged.passed, 0);
        await other.post("/me/certificate", issueBody(forged)).expect(409);
        assert.equal(await Certificate.countDocuments(), 0);
      },
    );
    await t.test(
      "high average just under 70 in one module stays locked; 70.8 unlocks",
      async () => {
        await learner.finish("manual-handling");
        await learner.finish("working-at-height");
        // 29 wrong attempts across the 24 questions: 2400 - 25*29 = 1675
        // -> 1675/24 = 69.8 (just under the pass mark).
        const failed = await learner.finish("hazard-perception", {
          wrongs: [
            [4, 4, 4, 0, 0, 0, 0, 0],
            [4, 4, 4, 0, 0, 0, 0, 0],
            [4, 1, 0, 0, 0, 0, 0, 0],
          ],
        });
        assert.equal(failed.attempt.result.score, 69.8);
        const locked = (await learner.get("/me/certificate")).body;
        assert.equal(locked.passed, 2);
        assert.equal(locked.overallScore, 89.9);
        assert.equal(locked.eligible, false);
        await learner.post("/me/certificate", issueBody(locked)).expect(409);
        // 28 wrong attempts: 2400 - 25*28 = 1700 -> 1700/24 = 70.8 (passes).
        const passed = await learner.finish("hazard-perception", {
          wrongs: [
            [4, 4, 4, 0, 0, 0, 0, 0],
            [4, 4, 4, 0, 0, 0, 0, 0],
            [4, 0, 0, 0, 0, 0, 0, 0],
          ],
        });
        assert.equal(passed.attempt.result.score, 70.8);
        ready = (await learner.get("/me/certificate")).body;
        assert.equal(ready.eligible, true);
        assert.equal(ready.canIssue, true);
        assert.equal(ready.overallScore, 90.3);
        assert.equal(ready.certificate, null);
        assert.equal(await Certificate.countDocuments(), 0); // GET never issues a record.
        const state = (await learner.get("/me/training")).body;
        assert.equal(state.completion.eligible, true);
      },
    );
    await t.test(
      "stale/forged previews are rejected and simultaneous issuance is idempotent",
      async () => {
        await learner
          .post("/me/certificate", {
            ...issueBody(ready),
            score: 100,
            employeeName: "Forged",
          })
          .expect(422);
        await learner
          .post("/me/certificate", {
            ...issueBody(ready),
            recipientId: String(otherUser._id),
          })
          .expect(403);
        await learner
          .post("/me/certificate", {
            ...issueBody(ready),
            reviewKey: "0".repeat(64),
          })
          .expect(409);
        const results = await Promise.all([
          learner.post("/me/certificate", issueBody(ready)),
          learner.post("/me/certificate", issueBody(ready)),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
        assert.equal(
          results[0].body.certificate.certificateId,
          results[1].body.certificate.certificateId,
        );
        initialRecord = results[0].body.certificate;
        assert.equal(initialRecord.valid, true);
        assert.equal(initialRecord.overallScore, 90.3);
        assert.equal(initialRecord.employeeName, "Nima Rai");
        assert.equal(
          await Certificate.countDocuments({ employeeId: learnerUser._id }),
          1,
        );
        assert.equal(
          await Audit.countDocuments({
            action: "issued a completion certificate",
            subject: { $regex: initialRecord.certificateId },
          }),
          1,
        );
        const repeat = (
          await learner.post("/me/certificate", issueBody(ready)).expect(200)
        ).body.certificate;
        assert.equal(repeat.issuedAt, initialRecord.issuedAt);
      },
    );
    await t.test(
      "PDF download is one page, authenticated and bound to the expected certificate ID",
      async () => {
        const pdf = await learner
          .get(
            "/me/certificate/pdf?certificateId=" + initialRecord.certificateId,
          )
          .expect(200);
        assert.match(pdf.headers["content-type"], /application\/pdf/);
        assert.match(
          pdf.headers["content-disposition"],
          new RegExp(initialRecord.certificateId),
        );
        assert.equal(pdf.headers["cache-control"], "no-store");
        assert.ok(Buffer.isBuffer(pdf.body));
        assert.equal(pdf.body.subarray(0, 4).toString(), "%PDF");
        assert.equal(
          (pdf.body.toString("latin1").match(/\/Type\s*\/Page\b/g) || [])
            .length,
          1,
        );
        await writeFile(
          path.join(artifacts, "completion-certificate.pdf"),
          pdf.body,
        );
        await learner
          .get("/me/certificate/pdf?certificateId=another-record")
          .expect(409);
        await other
          .get(
            "/me/certificate/pdf?certificateId=" + initialRecord.certificateId,
          )
          .expect(409);
        await other
          .get(`/admin/employees/${learnerUser._id}/certificate/pdf`)
          .expect(403);
        await admin
          .get(`/admin/employees/${learnerUser._id}/certificate/pdf`)
          .expect(200);
      },
    );
    await t.test(
      "later practice and profile changes do not rewrite the issued snapshot",
      async () => {
        await learner.finish("hazard-perception");
        await User.updateOne(
          { _id: learnerUser._id },
          { $set: { firstName: "Nima Updated" } },
        );
        const status = (await learner.get("/me/certificate")).body;
        assert.equal(status.overallScore, 100);
        assert.equal(status.certificate.overallScore, 90.3);
        assert.equal(status.certificate.employeeName, "Nima Rai");
        assert.equal(status.snapshotDiffers, true);
        assert.equal(
          status.certificate.certificateId,
          initialRecord.certificateId,
        );
        assert.equal(status.certificate.issuedAt, initialRecord.issuedAt);
        const repeat = (
          await learner.post("/me/certificate", issueBody(ready)).expect(200)
        ).body;
        assert.equal(repeat.certificate.overallScore, 90.3);
        assert.equal(
          await Certificate.countDocuments({ employeeId: learnerUser._id }),
          1,
        );
      },
    );
    await t.test(
      "forged question evidence, wrong owner and incomplete journeys fail verification",
      async () => {
        const original = await TrainingAttempt.findOne({
          employeeId: learnerUser._id,
          moduleKey: "manual-handling",
          phase: "completed",
        }).lean();
        assert.ok(verifyCompletedAttempt(original, learnerUser._id));
        assert.equal(verifyCompletedAttempt(original, otherUser._id), null);
        const clone = () =>
          structuredClone({
            ...original,
            _id: String(original._id),
            employeeId: String(original.employeeId),
          });
        const missingQuestion = clone();
        missingQuestion.questions.pop();
        assert.equal(
          verifyCompletedAttempt(missingQuestion, learnerUser._id),
          null,
          "a dropped question entry fails",
        );
        const wrongOwnerQ = clone();
        const mhCourse = (await import("../server/training-content.js"))
          .COURSES["manual-handling"];
        wrongOwnerQ.questions[0].questionId =
          mhCourse.levels[1].questions[0].id;
        assert.equal(
          verifyCompletedAttempt(wrongOwnerQ, learnerUser._id),
          null,
          "a question entry from the wrong level fails",
        );
        const inflated = clone();
        // Change the evidence so it no longer sums to the stored score.
        inflated.questions[0].wrongAttempts += 2;
        assert.equal(
          verifyCompletedAttempt(inflated, learnerUser._id),
          null,
          "score that no longer matches the evidence fails",
        );
        const neverAnswered = clone();
        neverAnswered.questions[0].correctAt = null;
        assert.equal(
          verifyCompletedAttempt(neverAnswered, learnerUser._id),
          null,
          "a question without a completion timestamp fails",
        );
        const openAttempt = clone();
        openAttempt.open = true;
        assert.equal(
          verifyCompletedAttempt(openAttempt, learnerUser._id),
          null,
          "an open attempt is not completed evidence",
        );
        const staleVersion = clone();
        staleVersion.version = "journey-2026-v0";
        assert.equal(
          verifyCompletedAttempt(staleVersion, learnerUser._id),
          null,
          "an older course version is not current evidence",
        );
      },
    );
    await t.test(
      "tampered certificate or linked evidence blocks downloads instead of silently reissuing",
      async () => {
        const stored = await Certificate.findOne({
          employeeId: learnerUser._id,
        }).lean();
        await Certificate.collection.updateOne(
          { _id: stored._id },
          { $set: { overallScore: 100 } },
        );
        assert.equal(
          (await learner.get("/me/certificate")).body.status,
          "review",
        );
        await learner.get("/me/certificate/pdf").expect(409);
        await learner.post("/me/certificate", issueBody(ready)).expect(409);
        await Certificate.collection.updateOne(
          { _id: stored._id },
          { $set: { overallScore: stored.overallScore } },
        );
        const proof = await TrainingAttempt.findById(
          stored.modules[0].attemptId,
        ).lean();
        const originalWrongAttempts = proof.questions[0].wrongAttempts;
        await TrainingAttempt.collection.updateOne(
          { _id: proof._id },
          { $set: { "questions.0.wrongAttempts": originalWrongAttempts + 1 } },
        );
        assert.equal(
          (await learner.get("/me/certificate")).body.certificate.valid,
          false,
        );
        await admin
          .get(`/admin/employees/${learnerUser._id}/certificate/pdf`)
          .expect(409);
        await TrainingAttempt.collection.updateOne(
          { _id: proof._id },
          { $set: { "questions.0.wrongAttempts": originalWrongAttempts } },
        );
        assert.equal(
          (await learner.get("/me/certificate")).body.certificate.valid,
          true,
        );
      },
    );
    await t.test(
      "admin issuance works and the PDF supports mixed Devanagari/Latin names",
      async () => {
        for (const key of [
          "manual-handling",
          "working-at-height",
          "hazard-perception",
        ])
          await unicode.finish(key);
        const status = (
          await admin.get(`/admin/employees/${unicodeUser._id}/certificate`)
        ).body;
        assert.equal(status.canIssue, true);
        const result = (
          await admin
            .post(
              `/admin/employees/${unicodeUser._id}/certificate`,
              issueBody(status),
            )
            .expect(201)
        ).body;
        assert.equal(result.certificate.employeeName, "आशा Rai");
        assert.equal(result.certificate.valid, true);
        const pdf = await unicode.get("/me/certificate/pdf").expect(200);
        await writeFile(
          path.join(artifacts, "unicode-certificate.pdf"),
          pdf.body,
        );
        assert.equal(
          (pdf.body.toString("latin1").match(/\/Type\s*\/Page\b/g) || [])
            .length,
          1,
        );
        const list = (await admin.get("/admin/certificates").expect(200)).body
          .records;
        assert.equal(
          list.find((r) => r.employee.id === String(unicodeUser._id)).completion
            .status,
          "issued",
        );
      },
    );
    await t.test(
      "deactivation blocks the employee, preserves admin access; deletion removes the certificate",
      async () => {
        await admin
          .patch(`/admin/employees/${learnerUser._id}/status`, {
            status: "inactive",
          })
          .expect(200);
        await learner.get("/me/certificate/pdf").expect(401);
        await admin
          .get(`/admin/employees/${learnerUser._id}/certificate/pdf`)
          .expect(200);
        await admin
          .post(
            `/admin/employees/${learnerUser._id}/certificate`,
            issueBody(ready),
          )
          .expect(409);
        await admin
          .patch(`/admin/employees/${learnerUser._id}/status`, {
            status: "active",
          })
          .expect(200);
        await learner.login("cert.learner");
        assert.equal(
          (await learner.get("/me/certificate")).body.certificate.certificateId,
          initialRecord.certificateId,
        );
        await admin
          .delete(`/admin/employees/${learnerUser._id}`, {
            confirmation: "cert.learner",
          })
          .expect(200);
        assert.equal(
          await Certificate.countDocuments({ employeeId: learnerUser._id }),
          0,
        );
        await admin
          .get(`/admin/employees/${learnerUser._id}/certificate/pdf`)
          .expect(404);
      },
    );
  },
);
