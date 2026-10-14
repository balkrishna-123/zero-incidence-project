import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import supertest from "supertest";
const temp = await mkdtemp(path.join(os.tmpdir(), "zi-manual-api-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "true";
process.env.DATA_DIR = temp;
process.env.SESSION_SECRET =
  "manual-handling-test-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");
const { seedDatabase } = await import("../server/seed.js");
const { User, Progress } = await import("../server/models.js");
const { TrainingAttempt } = await import("../server/training-models.js");
const { COURSES } = await import("../server/training-content.js");
const { hashPassword } = await import("../server/passwords.js");
const course = COURSES["manual-handling"];
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

// Answer every question of one level: `wrongs[i]` wrong attempts first, then
// the correct answer (retry until correct is the journey rule).
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
      assert.equal(r.feedback.questionScore, Math.max(0, 100 - 25 * (w + 1)));
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
// intro -> (study -> quiz) x3 -> completed, with the planned wrong attempts.
async function runModule(c, id, plan) {
  await c.post(pathFor(id) + "/advance", {}).expect(200);
  for (let level = 0; level < 3; level++) {
    await c.post(pathFor(id) + "/advance", {}).expect(200);
    const inQuiz = (await c.get(pathFor(id)).expect(200)).body;
    assert.equal(inQuiz.attempt.phase, "quiz");
    assert.equal(inQuiz.attempt.levelIndex, level);
    await answerLevel(c, id, level, plan[level]);
    if (level < 2) await c.post(pathFor(id) + "/advance", {}).expect(200);
  }
  return (await c.post(pathFor(id) + "/advance", {}).expect(200)).body;
}

test("Manual Handling: journey map, level quizzes, average final result", { timeout: 180000 }, async (t) => {
  const uri = await connectDatabase({ isolated: true });
  await seedDatabase();
  const app = await createApp(uri);
  t.after(async () => {
    await app.locals.sessionStore.close();
    await disconnectDatabase();
    await rm(temp, { recursive: true, force: true });
  });
  const hash = await hashPassword("ModuleTest!2026");
  const user = await User.create({
    firstName: "Module",
    lastName: "Tester",
    age: 26,
    username: "module.tester",
    role: "employee",
    status: "active",
    passwordHash: hash,
    mustChangePassword: false,
  });
  await User.create({
    firstName: "Other",
    lastName: "Learner",
    age: 26,
    username: "other.learner",
    role: "employee",
    passwordHash: hash,
    mustChangePassword: false,
  });
  const learner = client(app),
    other = client(app),
    admin = client(app),
    pending = client(app);
  await learner.login("module.tester", "ModuleTest!2026");
  await other.login("other.learner", "ModuleTest!2026");
  await admin.login("safety.admin", "ZeroIncident!2026");
  await pending.login("ramesh.s", "Welcome!2026");
  let id;

  await t.test(
    "only ready employees can use the module; answers and hints stay private",
    async () => {
      await supertest(app).get("/api/training/manual-handling").expect(401);
      await admin.get("/training/manual-handling").expect(403);
      await pending.get("/training/manual-handling").expect(403);
      const meta = (
        await learner.get("/training/manual-handling").expect(200)
      ).body;
      assert.equal(meta.course.levelCount, 3);
      assert.equal(meta.course.questionCount, 24);
      assert.equal(meta.course.questionsPerLevel, 8);
      assert.equal(meta.course.questionTimeLimit, 20);
      assert.deepEqual(
        meta.course.levels.map((l) => l.questionCount),
        [8, 8, 8],
        "eight questions per level",
      );
      assert.deepEqual(
        meta.course.levels.map((l) => l.sectionCount),
        [4, 5, 6],
        "study depth increases per level",
      );
      assert.equal(meta.course.levels[0].study.boards.length, 3);
      // Lesson sections are also rendered as boards inside the 360° view.
      assert.deepEqual(
        meta.course.levels.map((l) => l.study.lessonBoards.length),
        [4, 5, 6],
        "one lesson board per section in the 360 view",
      );
      assert.equal(meta.course.levels[0].study.sections.length, 4);
      assert.ok(meta.course.levels[0].study.intro.length > 40);
      assert.equal(meta.course.intro.learn.length, 5);
      assert.equal(meta.trainer.nickname, "Yeti");
      assert.equal(JSON.stringify(meta).includes("correctId"), false);
      assert.equal(JSON.stringify(meta).includes("hint"), false);
      assert.equal(meta.course.questions, undefined);
      await learner.get("/training/unsafe-acts").expect(404);
      await learner
        .post("/training/unsafe-acts/start", { acknowledged: true })
        .expect(404);
      const hub = (await learner.get("/me/training")).body;
      assert.equal(
        hub.modules.filter((m) => m.assessmentAvailable).length,
        3,
      );
      await learner
        .post("/training/manual-handling/start", { acknowledged: false })
        .expect(422);
    },
  );

  await t.test("one resumable attempt per employee and module", async () => {
    const start = await Promise.all([
      learner.post("/training/manual-handling/start", {
        acknowledged: true,
      }),
      learner.post("/training/manual-handling/start", {
        acknowledged: true,
      }),
    ]);
    start.forEach((r) => assert.equal(r.status, 200));
    id = start[0].body.attempt.id;
    assert.equal(start[1].body.attempt.id, id);
    assert.equal(start[0].body.attempt.phase, "intro");
    assert.equal(
      await TrainingAttempt.countDocuments({
        employeeId: user._id,
        open: true,
      }),
      1,
    );
    await other.get(pathFor(id)).expect(404);
    await other
      .post(pathFor(id) + "/quiz/answer", {
        questionId: "mh-q1",
        optionId: "choice-1",
      })
      .expect(404);
    assert.equal(
      (await learner.get("/me/training")).body.activeTraining[
        "manual-handling"
      ].id,
      id,
    );
  });

  await t.test(
    "concurrent duplicate clicks cannot double-record a quiz answer",
    async () => {
      const s = (
        await other
          .post("/training/hazard-perception/start", { acknowledged: true })
          .expect(200)
      ).body;
      const oid = s.attempt.id;
      await other.post(pathFor(oid) + "/advance", {}).expect(200);
      await other.post(pathFor(oid) + "/advance", {}).expect(200);
      const st = (await other.get(pathFor(oid)).expect(200)).body;
      const qid = st.attempt.currentQuestion.id;
      const def =
        COURSES["hazard-perception"].levels[0].questions.find(
          (q) => q.id === qid,
        );
      const race = await Promise.all([
        other.post(pathFor(oid) + "/quiz/answer", {
          questionId: qid,
          optionId: wrongOf(def),
        }),
        other.post(pathFor(oid) + "/quiz/answer", {
          questionId: qid,
          optionId: def.correctId,
        }),
      ]);
      const codes = race.map((r) => r.status).sort();
      assert.ok(
        codes.join() === "200,200" || codes.join() === "200,409",
        "one answer wins, the duplicate is accepted-then-rejected or 409",
      );
      const saved = await TrainingAttempt.findById(oid);
      const entry = saved.questions.find((x) => x.questionId === qid);
      assert.ok(entry.correctAt, "question ended answered correctly");
      assert.ok(entry.wrongAttempts <= 1);
    },
  );

  await t.test(
    "the journey gates each stage: no quiz before study, no study before quiz, no final before the last quiz",
    async () => {
      // intro: no current question, answers and hints rejected
      await learner
        .post(pathFor(id) + "/quiz/answer", {
          questionId: "mh-q1",
          optionId: "choice-1",
        })
        .expect(409);
      await learner
        .post(pathFor(id) + "/hint", { questionId: "mh-q1" })
        .expect(409);
      // intro -> study(0)
      const toStudy = (
        await learner.post(pathFor(id) + "/advance", {}).expect(200)
      ).body;
      assert.equal(toStudy.attempt.phase, "study");
      assert.equal(toStudy.attempt.levelIndex, 0);
      await learner
        .post(pathFor(id) + "/quiz/answer", {
          questionId: "mh-q1",
          optionId: "choice-1",
        })
        .expect(409);
      // study -> quiz(0)
      await learner.post(pathFor(id) + "/advance", {}).expect(200);
      const inQuiz = (await learner.get(pathFor(id)).expect(200)).body;
      assert.equal(inQuiz.attempt.phase, "quiz");
      const q = inQuiz.attempt.currentQuestion;
      assert.ok(
        course.levels[0].questions.some((x) => x.id === q.id),
        "level 1 question",
      );
      // answering a non-current question is rejected
      const otherQ = course.levels[0].questions.find(
        (x) => x.id !== q.id,
      ).id;
      await learner
        .post(pathFor(id) + "/quiz/answer", {
          questionId: otherQ,
          optionId: "choice-1",
        })
        .expect(409);
      // advancing mid-quiz is rejected until all three are correct
      await learner.post(pathFor(id) + "/advance", {}).expect(409);
      // hint works during the quiz and is recorded
      const hint = (
        await learner
          .post(pathFor(id) + "/hint", { questionId: q.id })
          .expect(200)
      ).body;
      assert.equal(
        hint.hint,
        course.levels[0].questions.find((x) => x.id === q.id).hint,
      );
      // one wrong answer keeps the question open with a docked score
      const wrong = (
        await learner
          .post(pathFor(id) + "/quiz/answer", {
            questionId: q.id,
            optionId: wrongOf(course.levels[0].questions.find((x) => x.id === q.id)),
          })
          .expect(200)
      ).body;
      assert.equal(wrong.feedback.correct, false);
      assert.equal(wrong.feedback.questionScore, 75);
      assert.equal(wrong.feedback.wrongAttempts, 1);
      assert.equal(wrong.feedback.levelDone, false);
      await learner.post(pathFor(id) + "/advance", {}).expect(409);
      const stillCurrent = (
        await learner.get(pathFor(id)).expect(200)
      ).body.attempt.currentQuestion;
      assert.equal(stillCurrent.id, q.id);
      // correct answer resolves it
      const right = (
        await learner
          .post(pathFor(id) + "/quiz/answer", {
            questionId: q.id,
            optionId: course.levels[0].questions.find((x) => x.id === q.id).correctId,
          })
          .expect(200)
      ).body;
      assert.equal(right.feedback.correct, true);
      assert.equal(right.feedback.questionScore, 75);
      // re-answering a finished question is rejected
      await learner
        .post(pathFor(id) + "/quiz/answer", {
          questionId: q.id,
          optionId: "choice-1",
        })
        .expect(409);
      // finish level 1 (the other seven questions, clean)
      for (const extra of [1, 2, 3, 4, 5, 6, 7]) {
        const st = (await learner.get(pathFor(id)).expect(200)).body;
        const next = st.attempt.currentQuestion;
        const def = course.levels[0].questions.find((x) => x.id === next.id);
        const r = (
          await learner
            .post(pathFor(id) + "/quiz/answer", {
              questionId: next.id,
              optionId: def.correctId,
            })
            .expect(200)
        ).body;
        assert.equal(r.feedback.correct, true);
        if (extra === 7) assert.equal(r.feedback.levelDone, true);
      }
      // level 1 complete -> next level study
      const toStudy2 = (
        await learner.post(pathFor(id) + "/advance", {}).expect(200)
      ).body;
      assert.equal(toStudy2.attempt.phase, "study");
      assert.equal(toStudy2.attempt.levelIndex, 1);
      assert.equal(toStudy2.attempt.levels[0].quizComplete, true);
    },
  );

  await t.test(
    "final result is the average of all twenty-four question scores, with per-level review",
    async () => {
      // continue from the gated subtest: L1 has 75,100×7 done.
      // L2: two wrong on q1 (50), then clean; L3: clean.
      await learner.post(pathFor(id) + "/advance", {}).expect(200); // -> quiz(1)
      await answerLevel(learner, id, 1, [2, 0, 0, 0, 0, 0, 0, 0]);
      await learner.post(pathFor(id) + "/advance", {}).expect(200); // -> study(2)
      await learner.post(pathFor(id) + "/advance", {}).expect(200); // -> quiz(2)
      await answerLevel(learner, id, 2, [0, 0, 0, 0, 0, 0, 0, 0]);
      const done = (
        await learner.post(pathFor(id) + "/advance", {}).expect(200)
      ).body;
      assert.equal(done.attempt.phase, "completed");
      assert.equal(done.attempt.open, false);
      const r = done.attempt.result;
      // (75+7×100 + 50+7×100 + 8×100) / 24 = 2325/24 = 96.9
      assert.equal(r.score, 96.9);
      assert.equal(r.passed, true);
      assert.equal(r.stars, 3);
      assert.equal(r.classification, "Excellent");
      assert.deepEqual(
        r.perLevel.map((l) => l.average),
        [96.9, 93.8, 100],
      );
      assert.equal(r.review.length, 24);
      const flagged = r.review.filter(
        (x) => x.wrongAttempts === 2 && x.score === 50,
      );
      assert.equal(flagged.length, 1);
      assert.equal(
        r.review.filter((x) => x.wrongAttempts === 1 && x.score === 75)
          .length,
        1,
      );
      assert.equal(
        r.review.filter((x) => x.hintUsed).length,
        1,
        "hint usage recorded in review",
      );
      // best score + progress updated from the genuine assessment
      assert.equal(done.bestScore, 96.9);
      const progress = (await learner.get("/me/training")).body.progress;
      const mh = progress.modules.find((m) => m.key === "manual-handling");
      assert.equal(mh.score, 96.9);
      assert.equal(mh.source, "assessment");
      assert.equal(progress.eligible, false);
      // certificate still locked: only one module genuinely passed
      const cert = (await learner.get("/me/certificate").expect(200)).body;
      assert.equal(cert.modules[0].verified, true);
      assert.equal(cert.modules[0].score, 96.9);
      assert.equal(cert.eligible, false);
      await learner.get("/me/certificate/pdf").expect(409);
      // finished attempts can be re-opened for review, not continued
      const review = (await learner.get(pathFor(id)).expect(200)).body;
      assert.equal(review.attempt.phase, "completed");
      assert.equal(review.attempt.currentQuestion, null);
    },
  );

  await t.test(
    "retakes preserve the best, improve it, and a failed run never lowers it",
    async () => {
      const eight = () => [0, 0, 0, 0, 0, 0, 0, 0];
      const perfect = await runModule(learner, (
        await learner
          .post("/training/manual-handling/start", { acknowledged: true })
          .expect(200)
      ).body.attempt.id, [
        eight(),
        eight(),
        eight(),
      ]);
      assert.equal(perfect.attempt.result.score, 100);
      assert.equal(perfect.bestScore, 100);
      const failing = await runModule(
        learner,
        (
          await learner
            .post("/training/manual-handling/start", { acknowledged: true })
            .expect(200)
        ).body.attempt.id,
        [
          [4, 4, 4, 4, 4, 4, 4, 4],
          [4, 4, 4, 4, 4, 4, 4, 4],
          [4, 4, 4, 4, 4, 4, 4, 4],
        ],
      );
      assert.equal(failing.attempt.result.score, 0);
      assert.equal(failing.attempt.result.passed, false);
      assert.equal(failing.attempt.result.classification, "Retake");
      assert.equal(failing.bestScore, 100, "earlier pass kept");
      const records = await Progress.find({ employeeId: user._id }).lean();
      assert.equal(records.length, 1);
      assert.equal(records[0].score, 100);
      assert.equal(records[0].attempts, 3);
      assert.equal(records[0].lastScore, 0);
      const meta = (
        await learner.get("/training/manual-handling").expect(200)
      ).body;
      assert.equal(meta.bestScore, 100);
      assert.equal(meta.history.length, 3);
      assert.deepEqual(
        meta.history.map((h) => h.score),
        [0, 100, 96.9],
        "newest first",
      );
      const detail = (
        await admin.get(`/admin/employees/${user._id}`).expect(200)
      ).body;
      const admMh = detail.progress.modules.find(
        (m) => m.key === "manual-handling",
      );
      assert.equal(admMh.score, 100);
      assert.equal(admMh.source, "assessment");
    },
  );

  await t.test(
    "the 20-second clock: timeout is a wrong attempt, the window resets, late answers are charged server-side",
    async () => {
      const s = (
        await learner
          .post("/training/manual-handling/start", { acknowledged: true })
          .expect(200)
      ).body;
      const tid = s.attempt.id;
      await learner.post(pathFor(tid) + "/advance", {}).expect(200); // -> study
      await learner.post(pathFor(tid) + "/advance", {}).expect(200); // -> quiz
      let st = (await learner.get(pathFor(tid)).expect(200)).body.attempt;
      assert.equal(st.currentQuestion.timeLimit, 20, "time limit exposed");
      assert.ok(st.currentQuestion.openedAt, "window opened on entry to quiz");
      const qid = st.currentQuestion.id;
      const def = course.levels[0].questions.find((q) => q.id === qid);

      // Client reports the timeout: charged as one attempt, window restarts.
      const to = (
        await learner
          .post(pathFor(tid) + "/quiz/timeout", { questionId: qid })
          .expect(200)
      ).body;
      assert.equal(to.feedback.correct, false);
      assert.equal(to.feedback.timedOut, true);
      assert.equal(to.feedback.wrongAttempts, 1);
      assert.equal(to.feedback.questionScore, 75);
      const oldOpened = st.currentQuestion.openedAt;
      st = (await learner.get(pathFor(tid)).expect(200)).body.attempt;
      assert.notEqual(st.currentQuestion.openedAt, oldOpened, "window restarted");

      // A prompt correct answer right after the reset is accepted.
      const ok = (
        await learner
          .post(pathFor(tid) + "/quiz/answer", { questionId: qid, optionId: def.correctId })
          .expect(200)
      ).body;
      assert.equal(ok.feedback.correct, true);
      assert.equal(ok.feedback.timedOut, false);
      assert.equal(ok.feedback.questionScore, 75);

      // Server-side enforcement: backdate the window past 20 s, then even a
      // correct answer is charged as a timeout.
      const doc = await TrainingAttempt.findById(tid);
      doc.currentOpenedAt = new Date(Date.now() - 21_000);
      await doc.save();
      st = (await learner.get(pathFor(tid)).expect(200)).body.attempt;
      const qid2 = st.currentQuestion.id;
      const def2 = course.levels[0].questions.find((q) => q.id === qid2);
      const late = (
        await learner
          .post(pathFor(tid) + "/quiz/answer", { questionId: qid2, optionId: def2.correctId })
          .expect(200)
      ).body;
      assert.equal(late.feedback.correct, false, "late answer is not credited");
      assert.equal(late.feedback.timedOut, true);
      assert.equal(late.feedback.questionScore, 75);
      // Timeouts are kept separate from wrong attempts on the entry.
      const saved = await TrainingAttempt.findById(tid);
      const entry = saved.questions.find((x) => x.questionId === qid2);
      assert.equal(entry.timeouts, 1);
      assert.equal(entry.wrongAttempts, 1);
    },
  );

  await t.test(
    "attempts from the previous journey format are legacy: not continuable, retired on start, stored scores preserved in history",
    async () => {
      const wah = COURSES["working-at-height"];
      const v1Orders = wah.levels.map((l) => l.questions.slice(0, 3).map((q) => q.id));
      // In-progress attempt as written by the previous release (3 q/level).
      await TrainingAttempt.collection.insertOne({
        employeeId: user._id,
        moduleKey: "working-at-height",
        version: "journey-2026-v1",
        phase: "quiz",
        open: true,
        levelIndex: 1,
        levelOrders: v1Orders,
        optionOrders: {},
        questions: [],
        score: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0,
      });
      const legacyInProg = (
        await learner.get("/training/working-at-height").expect(200)
      ).body.activeAttemptId;
      const shown = (
        await learner.get(`/training/attempts/${legacyInProg}`).expect(200)
      ).body;
      assert.equal(shown.attempt.legacy, true, "flagged legacy");
      assert.equal(shown.attempt.phase, "quiz");
      assert.equal(
        shown.attempt.currentQuestion,
        null,
        "legacy quiz is not served to the current flow",
      );
      // Starting retires it and creates a fresh journey.
      const s = (
        await learner
          .post("/training/working-at-height/start", { acknowledged: true })
          .expect(200)
      ).body;
      assert.equal(s.attempt.phase, "intro");
      assert.equal(s.attempt.legacy, false);
      const retired = await TrainingAttempt.findById(legacyInProg);
      assert.equal(retired.open, false, "previous-format attempt retired");
      assert.equal(
        await TrainingAttempt.countDocuments({
          employeeId: user._id,
          moduleKey: "working-at-height",
          open: true,
        }),
        1,
      );
      // A completed previous-format attempt keeps its stored score in history.
      const doneV1 = {
        employeeId: user._id,
        moduleKey: "working-at-height",
        version: "journey-2026-v1",
        phase: "completed",
        open: false,
        levelIndex: 2,
        levelOrders: v1Orders,
        optionOrders: {},
        questions: [],
        score: 85,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0,
      };
      const v1Id = (
        await TrainingAttempt.collection.insertOne(doneV1)
      ).insertedId;
      const meta = (
        await learner.get("/training/working-at-height").expect(200)
      ).body;
      const row = meta.history.find((h) => h.id === String(v1Id));
      assert.ok(row, "previous-format completion listed in history");
      assert.equal(row.score, 85, "stored score, not a recomputed average");
      assert.equal(row.passed, true);
      assert.equal(row.classification, "Previous format");
      // Reviewing a legacy completion shows the stored result, not the 24-q one.
      const rev = (
        await learner.get(`/training/attempts/${v1Id}`).expect(200)
      ).body;
      assert.equal(rev.attempt.legacy, true);
      assert.equal(rev.attempt.result.legacy, true);
      assert.equal(rev.attempt.result.score, 85);
      // Clean up fixtures; close the fresh attempt so the unique
      // (employee, module, open) index stays free for the next subtest.
      await TrainingAttempt.deleteOne({ _id: v1Id });
      await TrainingAttempt.updateOne(
        { _id: s.attempt.id },
        { $set: { open: false } },
      );
    },
  );

  await t.test(
    "fun quiz: ten random questions across modules, no answers leaked, answered for practice only",
    async () => {
      const allQuestions = Object.values(COURSES).flatMap((c) =>
        c.levels.flatMap((l) => l.questions),
      );
      // Employees get the quiz; other roles do not.
      await admin.get("/training/fun-quiz").expect(403);
      const f = (await learner.get("/training/fun-quiz").expect(200)).body;
      assert.equal(f.questionTimeLimit, 20);
      assert.equal(f.questions.length, 10);
      const ids = f.questions.map((q) => q.id);
      assert.equal(new Set(ids).size, 10, "unique questions");
      const blob = JSON.stringify(f);
      assert.equal(blob.includes("correctId"), false, "no answer leak");
      assert.equal(blob.includes("correctText"), false, "no answer leak");
      assert.equal(blob.includes("explanation"), false, "no answer leak");
      assert.equal(blob.includes("hint"), false, "no answer leak");
      for (const q of f.questions) {
        assert.equal(q.options.length, 3);
        assert.ok(allQuestions.some((x) => x.id === q.id), "known question");
      }
      const first = f.questions[0];
      const def = allQuestions.find((x) => x.id === first.id);
      const right = (
        await learner
          .post("/training/fun-quiz/answer", {
            questionId: first.id,
            optionId: def.correctId,
          })
          .expect(200)
      ).body;
      assert.equal(right.correct, true);
      assert.equal(
        right.correctText,
        def.options.find((o) => o.id === def.correctId).text,
      );
      assert.ok(right.reference.url.length > 10);
      const wrongOpt = def.options.find((o) => o.id !== def.correctId);
      const wrong = (
        await learner
          .post("/training/fun-quiz/answer", {
            questionId: first.id,
            optionId: wrongOpt.id,
          })
          .expect(200)
      ).body;
      assert.equal(wrong.correct, false);
      await learner
        .post("/training/fun-quiz/answer", {
          questionId: "mh-q99",
          optionId: "choice-1",
        })
        .expect(404);
      // Practice only: answering changes nothing on the assessment record.
      const p = (await learner.get("/me/training")).body.progress;
      const mh = p.modules.find((m) => m.key === "manual-handling");
      assert.equal(mh.source, "assessment");
      assert.equal(mh.score, 100, "best genuine score untouched");
    },
  );

  await t.test(
    "demonstration marks cannot override a genuine first assessment",
    async () => {
      const demo = client(app);
      await demo.login("anisha.g", "DemoOnly!2026");
      const s = (
        await demo
          .post("/training/manual-handling/start", { acknowledged: true })
          .expect(200)
      ).body;
      await runModule(demo, s.attempt.id, [
        [4, 4, 4, 4, 4, 4, 4, 4],
        [4, 4, 4, 4, 4, 4, 4, 4],
        [4, 4, 4, 4, 4, 4, 4, 4],
      ]);
      const p = (await demo.get("/me/training")).body.progress;
      const mh = p.modules.find((m) => m.key === "manual-handling");
      assert.equal(mh.score, 0);
      assert.equal(mh.source, "assessment");
      assert.equal(mh.attempts, 1);
      assert.equal(
        p.modules.find((m) => m.key === "working-at-height").source,
        "demo",
      );
      assert.equal(p.eligible, false);
    },
  );

  await t.test(
    "pre-journey legacy attempts are retired on start, never scored as 0",
    async () => {
      // Simulate an attempt saved by the pre-journey release (different
      // phase vocabulary, no levelOrders) via a raw collection write.
      await TrainingAttempt.collection.insertOne({
        employeeId: user._id,
        moduleKey: "working-at-height",
        version: "legacy-1.5",
        phase: "quiz-ready",
        open: true,
        levelIndex: undefined,
        activityAnswers: [],
        quizAnswers: [],
        inspected: [],
        score: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0,
      });
      // The overview must not surface it as a resumable journey…
      const meta = (
        await learner.get("/training/working-at-height").expect(200)
      ).body;
      // …and starting retires it and creates a fresh journey attempt.
      const s = (
        await learner
          .post("/training/working-at-height/start", { acknowledged: true })
          .expect(200)
      ).body;
      assert.equal(s.attempt.phase, "intro");
      assert.equal(
        await TrainingAttempt.countDocuments({
          employeeId: user._id,
          moduleKey: "working-at-height",
          open: true,
        }),
        1,
      );
      const attempts = await TrainingAttempt.find({
        employeeId: user._id,
        moduleKey: "working-at-height",
      }).lean();
      const legacy = attempts.find((a) => a.version === "legacy-1.5");
      assert.equal(legacy.open, false, "legacy attempt retired");
      assert.equal(meta.history.length, 0, "legacy attempts are not history");
      // Clean up the retired fixture.
      await TrainingAttempt.deleteOne({ _id: legacy._id });
      // Abandon the fresh attempt so later subtests see a clean state.
      await learner.post(`/training/attempts/${s.attempt.id}/advance`, {}).expect(200);
    },
  );

  await t.test(
    "deactivation revokes access, reactivation preserves results, deletion removes attempts",
    async () => {
      await admin
        .patch(`/admin/employees/${user._id}/status`, { status: "inactive" })
        .expect(200);
      await learner.get(pathFor(id)).expect(401);
      await admin
        .patch(`/admin/employees/${user._id}/status`, { status: "active" })
        .expect(200);
      await learner.login("module.tester", "ModuleTest!2026");
      assert.equal(
        (await learner.get("/me/training")).body.progress.modules.find(
          (m) => m.key === "manual-handling",
        ).score,
        100,
      );
      await admin
        .delete(`/admin/employees/${user._id}`, {
          confirmation: "module.tester",
        })
        .expect(200);
      assert.equal(
        await TrainingAttempt.countDocuments({ employeeId: user._id }),
        0,
      );
      assert.equal(
        await Progress.countDocuments({ employeeId: user._id }),
        0,
      );
      await learner.get("/training/manual-handling").expect(401);
    },
  );
});
