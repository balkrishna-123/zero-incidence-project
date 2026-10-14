import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import supertest from "supertest";
const temp = await mkdtemp(path.join(os.tmpdir(), "zi-height-api-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "true";
process.env.DATA_DIR = temp;
process.env.SESSION_SECRET =
  "working-at-height-test-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");
const { seedDatabase } = await import("../server/seed.js");
const { User } = await import("../server/models.js");
const { TrainingAttempt } = await import("../server/training-models.js");
const { COURSES } = await import("../server/training-content.js");
const { hashPassword } = await import("../server/passwords.js");
const course = COURSES["working-at-height"];
const pathFor = (id) => `/training/attempts/${id}`;
const wrongOf = (q) => q.options.find((o) => o.id !== q.correctId).id;

function client(app) {
  const agent = supertest.agent(app);
  let csrf;
  return {
    agent,
    async login(username, password) {
      csrf = (await agent.get("/api/session").expect(200)).body.csrfToken;
      const r = await agent
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ username, password })
        .expect(200);
      csrf = r.body.csrfToken;
      return r;
    },
    get: (u) => agent.get("/api" + u),
    post: (u, body) =>
      agent.post("/api" + u).set("X-CSRF-Token", csrf).send(body),
    patch: (u, body) =>
      agent.patch("/api" + u).set("X-CSRF-Token", csrf).send(body),
    delete: (u, body) =>
      agent.delete("/api" + u).set("X-CSRF-Token", csrf).send(body),
  };
}

async function answerLevel(c, id, level, wrongs) {
  const total = course.levels[level].questions.length;
  for (let qi = 0; qi < total; qi++) {
    const state = (await c.get(pathFor(id)).expect(200)).body;
    const qid = state.attempt.currentQuestion.id;
    const def = course.levels[level].questions.find((q) => q.id === qid);
    for (let w = 0; w < wrongs[qi]; w++) {
      const r = (
        await c
          .post(pathFor(id) + "/quiz/answer", { questionId: qid, optionId: wrongOf(def) })
          .expect(200)
      ).body;
      assert.equal(r.feedback.correct, false);
      assert.equal(r.feedback.levelDone, false, "a wrong answer never completes the level");
    }
    const r = (
      await c
        .post(pathFor(id) + "/quiz/answer", { questionId: qid, optionId: def.correctId })
        .expect(200)
    ).body;
    assert.equal(r.feedback.correct, true);
    assert.equal(
      r.feedback.questionScore,
      Math.max(0, 100 - 25 * wrongs[qi]),
    );
    assert.equal(r.feedback.levelDone, qi === total - 1);
  }
}
async function runModule(c, id, plan, hintOnLevel = null) {
  await c.post(pathFor(id) + "/advance", {}).expect(200);
  for (let level = 0; level < 3; level++) {
    await c.post(pathFor(id) + "/advance", {}).expect(200);
    if (hintOnLevel === level) {
      const st = (await c.get(pathFor(id)).expect(200)).body;
      const h = (
        await c
          .post(pathFor(id) + "/hint", { questionId: st.attempt.currentQuestion.id })
          .expect(200)
      ).body;
      assert.equal(
        h.hint,
        course.levels[level].questions.find(
          (q) => q.id === st.attempt.currentQuestion.id,
        ).hint,
      );
    }
    await answerLevel(c, id, level, plan[level]);
    if (level < 2) await c.post(pathFor(id) + "/advance", {}).expect(200);
  }
  return (await c.post(pathFor(id) + "/advance", {}).expect(200)).body;
}

test("Working at Height: 360-degree level studies and gated level quizzes", { timeout: 180000 }, async (t) => {
  const uri = await connectDatabase({ isolated: true });
  await seedDatabase();
  const app = await createApp(uri);
  t.after(async () => {
    await app.locals.sessionStore.close();
    await disconnectDatabase();
    await rm(temp, { recursive: true, force: true });
  });
  const hash = await hashPassword("HeightTest!2026");
  await User.create({
    firstName: "Height",
    lastName: "Tester",
    age: 29,
    username: "height.tester",
    role: "employee",
    status: "active",
    passwordHash: hash,
    mustChangePassword: false,
  });
  const learner = client(app),
    admin = client(app);
  await learner.login("height.tester", "HeightTest!2026");
  await admin.login("safety.admin", "ZeroIncident!2026");
  let id;

  await t.test("overview exposes study content but never answers or hints", async () => {
    const meta = (
      await learner.get("/training/working-at-height").expect(200)
    ).body;
    assert.equal(meta.course.levelCount, 3);
    assert.equal(meta.course.questionCount, 24);
    assert.equal(meta.course.questionsPerLevel, 8);
    assert.equal(meta.course.questionTimeLimit, 20);
    assert.deepEqual(
      meta.course.levels.map((l) => l.sectionCount),
      [4, 5, 6],
    );
    meta.course.levels.forEach((l) => {
      assert.equal(l.questionCount, 8);
      assert.equal(l.study.lessonBoards.length, l.sectionCount, "lesson boards in 360 view");
      assert.equal(l.questions, undefined, "no raw questions in overview");
      assert.ok(l.study.intro.length > 40, "study intro text");
      l.study.sections.forEach((s) => {
        assert.ok(s.title && s.body.length > 40);
      });
      l.study.boards.forEach((b) => {
        assert.ok(b.label && b.text && Array.isArray(b.position) && b.position.length === 3);
      });
    });
    assert.equal(meta.trainer.nickname, "Yeti");
    assert.equal(JSON.stringify(meta).includes("correctId"), false);
    assert.equal(JSON.stringify(meta).includes("hint"), false);
    assert.equal(meta.course.questions, undefined);
    assert.equal(meta.history.length, 0);
    await admin.get("/training/working-at-height").expect(403);
  });

  await t.test("final result is locked while any quiz is open", async () => {
    const s = (
      await learner
        .post("/training/working-at-height/start", { acknowledged: true })
        .expect(200)
    ).body;
    id = s.attempt.id;
    assert.equal(s.attempt.phase, "intro");
    assert.equal(s.attempt.result, null);
    assert.equal(s.attempt.currentQuestion, null);
    await learner.post(pathFor(id) + "/advance", {}).expect(200); // study(0)
    await learner.post(pathFor(id) + "/advance", {}).expect(200); // quiz(0)
    const mid = (await learner.get(pathFor(id)).expect(200)).body;
    assert.equal(mid.attempt.result, null, "no result before completion");
    assert.equal(mid.attempt.levelQuizComplete, false);
    assert.ok(mid.attempt.currentQuestion.id.startsWith("wh-"));
    // answer order and option shuffle are stable across reloads
    const reload = (await learner.get(pathFor(id)).expect(200)).body;
    assert.equal(reload.attempt.currentQuestion.id, mid.attempt.currentQuestion.id);
    assert.deepEqual(
      reload.attempt.currentQuestion.options.map((o) => o.id),
      mid.attempt.currentQuestion.options.map((o) => o.id),
    );
  });

  await t.test("one full journey: retry docking, hints, average final score", async () => {
    // L1: q2 one wrong (75); L2: q1 one wrong (75); L3: q3 two wrong (50) + hint.
    const z = () => [0, 0, 0, 0, 0, 0, 0, 0];
    const l1 = z(); l1[1] = 1;
    const l2 = z(); l2[0] = 1;
    const l3 = z(); l3[2] = 2;
    await answerLevel(learner, id, 0, l1);
    const toStudy1 = (
      await learner.post(pathFor(id) + "/advance", {}).expect(200)
    ).body;
    assert.equal(toStudy1.attempt.levelIndex, 1);
    assert.equal(toStudy1.attempt.phase, "study");
    assert.equal(toStudy1.attempt.levels[0].quizComplete, true);
    assert.equal(toStudy1.attempt.levels[1].quizComplete, false);
    await learner.post(pathFor(id) + "/advance", {}).expect(200); // quiz(1)
    await answerLevel(learner, id, 1, l2);
    await learner.post(pathFor(id) + "/advance", {}).expect(200); // study(2)
    await learner.post(pathFor(id) + "/advance", {}).expect(200); // quiz(2)
    const st3 = (await learner.get(pathFor(id)).expect(200)).body;
    await learner
      .post(pathFor(id) + "/hint", {
        questionId: st3.attempt.currentQuestion.id,
      })
      .expect(200);
    await answerLevel(learner, id, 2, l3);
    const done = (
      await learner.post(pathFor(id) + "/advance", {}).expect(200)
    ).body;
    assert.equal(done.attempt.phase, "completed");
    assert.equal(done.attempt.completedAt !== null, true);
    const r = done.attempt.result;
    // (100+75+6×100 + 75+7×100 + 100+100+50+5×100) / 24 = 2300/24 = 95.8
    assert.equal(r.score, 95.8);
    assert.equal(r.passed, true);
    assert.equal(r.stars, 3);
    assert.equal(r.classification, "Excellent");
    assert.deepEqual(r.perLevel.map((l) => l.average), [96.9, 96.9, 93.8]);
    assert.equal(r.review.length, 24);
    assert.equal(r.review.filter((x) => x.hintUsed).length, 1);
    assert.equal(r.review.filter((x) => x.score === 75).length, 2);
    assert.equal(r.review.filter((x) => x.score === 50).length, 1);
    assert.equal(done.bestScore, 95.8);
    const progress = (await learner.get("/me/training")).body.progress;
    const wh = progress.modules.find((m) => m.key === "working-at-height");
    assert.equal(wh.score, 95.8);
    assert.equal(wh.source, "assessment");
    const cert = (await learner.get("/me/certificate").expect(200)).body;
    assert.equal(cert.modules[1].verified, true);
    assert.equal(cert.modules[1].score, 95.8);
    assert.equal(cert.eligible, false);
    await learner.get("/me/certificate/pdf").expect(409);
  });

  await t.test("retake at 100 improves the best; history is newest first", async () => {
    const perfect = await runModule(
      learner,
      (
        await learner
          .post("/training/working-at-height/start", { acknowledged: true })
          .expect(200)
      ).body.attempt.id,
      [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ],
    );
    assert.equal(perfect.attempt.result.score, 100);
    assert.equal(perfect.bestScore, 100);
    const meta = (
      await learner.get("/training/working-at-height").expect(200)
    ).body;
    assert.deepEqual(
      meta.history.map((h) => h.score),
      [100, 95.8],
    );
    const stored = await TrainingAttempt.findById(id);
    assert.equal(stored.open, false);
    assert.equal(
      await TrainingAttempt.countDocuments({
        moduleKey: "working-at-height",
        open: true,
      }),
      0,
    );
  });

  await t.test(
    "certificate score is recomputed from evidence; an inconsistent attempt is rejected",
    async () => {
      const userId = (
        await User.findOne({ username: "height.tester" })
      )._id;
      // Two completed attempts exist: A=95.8 (some wrong answers) and
      // B=100 (all correct), newest first.
      const perfectAttempt = (
        await TrainingAttempt.find({
          employeeId: userId,
          phase: "completed",
        }).sort({ createdAt: -1 })
      )[0];
      // (1) Deflate B's stored score so it no longer matches B's all-correct
      // evidence. B fails verification and is excluded; the certificate falls
      // back to the clean attempt A (95.8). Tampering cannot lower or raise a
      // certificate score.
      await TrainingAttempt.updateOne(
        { _id: perfectAttempt._id },
        { $set: { score: 55 } },
      );
      const cert = (await learner.get("/me/certificate").expect(200)).body;
      const wh = cert.modules.find((m) => m.key === "working-at-height");
      assert.equal(wh.verified, true);
      assert.equal(wh.score, 95.8);
      // (2) Restore B's stored score so it is consistent with its evidence
      // again. B verifies (100) and becomes the module best.
      await TrainingAttempt.updateOne(
        { _id: perfectAttempt._id },
        { $set: { score: 100 } },
      );
      const cert2 = (await learner.get("/me/certificate").expect(200)).body;
      assert.equal(
        cert2.modules.find((m) => m.key === "working-at-height").score,
        100,
      );
      // (3) Isolated inflation proof: a fresh employee with a single
      // sub-perfect attempt cannot lift their certificate by editing the
      // stored score field, because verification recomputes from the
      // twenty-four stored question outcomes.
      await User.create({
        firstName: "Tamper",
        lastName: "Probe",
        age: 31,
        username: "tamper.probe",
        role: "employee",
        status: "active",
        passwordHash: hash,
        mustChangePassword: false,
      });
      const probe = client(app);
      await probe.login("tamper.probe", "HeightTest!2026");
      const ps = (
        await probe
          .post("/training/working-at-height/start", { acknowledged: true })
          .expect(200)
      ).body;
      const pz = () => [0, 0, 0, 0, 0, 0, 0, 0];
      const pl = pz(); pl[0] = 1;
      await runModule(probe, ps.attempt.id, [pl, pz(), pz()]);
      // Genuine score: (75 + 100*23)/24 = 2375/24 = 99.
      let pcert = (await probe.get("/me/certificate").expect(200)).body;
      let pwh = pcert.modules.find((m) => m.key === "working-at-height");
      assert.equal(pwh.verified, true);
      assert.equal(pwh.score, 99);
      const pAttempt = await TrainingAttempt.findOne({
        employeeId: (await User.findOne({ username: "tamper.probe" }))._id,
        phase: "completed",
      });
      // Inflate the stored score to 100.
      await TrainingAttempt.updateOne(
        { _id: pAttempt._id },
        { $set: { score: 100 } },
      );
      pcert = (await probe.get("/me/certificate").expect(200)).body;
      pwh = pcert.modules.find((m) => m.key === "working-at-height");
      // The inflated field is inconsistent with the evidence (99), so the
      // attempt is rejected and the certificate shows no verified 100.
      assert.equal(pwh.verified, false);
      assert.notEqual(pwh.score, 100);
    },
  );
});
