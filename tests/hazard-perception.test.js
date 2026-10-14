import test from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const tmp = await mkdtemp(path.join(os.tmpdir(), "zi-hazard-api-"));
process.env.NODE_ENV = "test";
process.env.DEMO_MODE = "true";
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = "hazard-test-only-not-a-production-secret";
const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");
const { seedDatabase } = await import("../server/seed.js");
const { User, Progress, progressSummary } = await import("../server/models.js");
const { TrainingAttempt } = await import("../server/training-models.js");
const { COURSES, COURSE_VERSION } =
  await import("../server/training-content.js");
const { hashPassword } = await import("../server/passwords.js");
const c = COURSES["hazard-perception"];
const isHazard = (id) => c.tasks.some((t) => t.objectId === id);
const route = (id) => `/training/attempts/${id}`;
function client(app) {
  const agent = supertest.agent(app);
  let csrf;
  return {
    agent,
    async login(username, password = "HazardTest!2026") {
      csrf = (await agent.get("/api/session").expect(200)).body.csrfToken;
      const r = await agent
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ username, password })
        .expect(200);
      csrf = r.body.csrfToken;
    },
    get: (u) => agent.get("/api" + u),
    post: (u, body) =>
      agent
        .post("/api" + u)
        .set("X-CSRF-Token", csrf)
        .send(body),
    patch: (u, body) =>
      agent
        .patch("/api" + u)
        .set("X-CSRF-Token", csrf)
        .send(body),
    delete: (u, body) =>
      agent
        .delete("/api" + u)
        .set("X-CSRF-Token", csrf)
        .send(body),
  };
}
async function completeWalk(
  api,
  id,
  { missed = [], wrongControls = [], falseFlags = [] } = {},
) {
  for (const object of [...c.objects].reverse()) {
    await api.post(route(id) + "/inspect", { objectId: object.id }).expect(200);
    const flagged = isHazard(object.id)
      ? !missed.includes(object.id)
      : falseFlags.includes(object.id);
    await api
      .post(route(id) + "/classify", { objectId: object.id, flagged })
      .expect(200);
    const t = c.tasks.find((t) => t.objectId === object.id);
    if (t)
      await api
        .post(route(id) + "/activity-answer", {
          taskId: t.id,
          optionId: wrongControls.includes(object.id)
            ? t.options.find((o) => o.id !== t.correctId).id
            : t.correctId,
        })
        .expect(200);
  }
}
async function completeQuiz(api, id, correctCount = 5) {
  let result = (await api.get(route(id)).expect(200)).body;
  for (let i = 0; i < 5; i++) {
    result = (
      await api
        .post(route(id) + "/quiz/next", {
          afterQuestionId: result.attempt.lastQuizQuestionId,
        })
        .expect(200)
    ).body;
    const q = c.questions.find(
      (q) => q.id === result.attempt.currentQuestion.id,
    );
    result = (
      await api
        .post(route(id) + "/quiz/answer", {
          questionId: q.id,
          optionId: i < correctCount ? q.correctId : null,
        })
        .expect(200)
    ).body;
  }
  return result;
}
// STALE: this suite targets the pre-journey Hazard Perception format
// (free-order /inspect + /classify + /activity-answer flow) that was replaced
// by the shared three-level journey. The journey mechanics — level quizzes,
// scoring, retry docking, hints, legacy retirement, completion and
// certificates — are covered for all three modules by
// manual-handling.test.js and working-at-height.test.js.
test(
  "Hazard Perception: free-order inspection, immutable judgements, scores and legacy preservation",
  {
    timeout: 180000,
    skip: "pre-journey format; journey coverage lives in manual-handling and working-at-height suites",
  },
  async (t) => {
    const uri = await connectDatabase({ isolated: true });
    await seedDatabase();
    const app = await createApp(uri);
    t.after(async () => {
      await app.locals.sessionStore.close();
      await disconnectDatabase();
      await rm(tmp, { recursive: true, force: true });
    });
    const hash = await hashPassword("HazardTest!2026");
    const user = await User.create({
      firstName: "Hazard",
      lastName: "Tester",
      age: 27,
      username: "hazard.tester",
      role: "employee",
      passwordHash: hash,
      mustChangePassword: false,
    });
    await User.create({
      firstName: "Other",
      lastName: "Learner",
      age: 24,
      username: "hazard.other",
      role: "employee",
      passwordHash: hash,
      mustChangePassword: false,
    });
    const learner = client(app),
      other = client(app),
      admin = client(app),
      pending = client(app);
    await learner.login("hazard.tester");
    await other.login("hazard.other");
    await admin.login("safety.admin", "ZeroIncident!2026");
    await pending.login("ramesh.s", "Welcome!2026");
    const legacy = [];
    const legacyDate = new Date("2026-09-01T09:00:00Z");
    for (const [key, quizCorrect] of [
      ["manual-handling", 4],
      ["working-at-height", 3],
    ]) {
      const course = COURSES[key];
      const qs = course.questions.slice(0, 5);
      const old = await TrainingAttempt.create({
        employeeId: user._id,
        moduleKey: key,
        version: course.version || COURSE_VERSION,
        phase: "completed",
        open: false,
        activityAnswers: course.tasks.map((x) => ({
          taskId: x.id,
          optionId: x.correctId,
          correct: true,
          answeredAt: legacyDate,
        })),
        inspected: course.objects.map((x) => x.id),
        quizOrder: qs.map((q) => q.id),
        optionOrders: Object.fromEntries(
          [...course.tasks, ...course.questions].map((q) => [
            q.id,
            q.options.map((o) => o.id),
          ]),
        ),
        quizAnswers: qs.map((q, i) => ({
          questionId: q.id,
          optionId: i < quizCorrect ? q.correctId : null,
          correct: i < quizCorrect,
          timedOut: i >= quizCorrect,
          answeredAt: legacyDate,
        })),
        activityScore: 70,
        quizScore: quizCorrect * 6,
        score: 70 + quizCorrect * 6,
        completedAt: legacyDate,
        recordedAt: legacyDate,
      });
      await Progress.create({
        employeeId: user._id,
        moduleKey: key,
        source: "assessment",
        score: old.score,
        activityScore: 70,
        quizScore: old.quizScore,
        bestAttemptId: old._id,
        attempts: 1,
        assessedAt: legacyDate,
      });
      legacy.push(old);
    }
    let id;
    const safe = c.objects.filter((o) => !isHazard(o.id));
    await t.test(
      "auth, readiness, CSRF, private keys and exactly three released modules",
      async () => {
        await supertest(app).get("/api/training/hazard-perception").expect(401);
        await admin.get("/training/hazard-perception").expect(403);
        await pending.get("/training/hazard-perception").expect(403);
        await learner.agent
          .post("/api/training/hazard-perception/start")
          .send({ acknowledged: true })
          .expect(403);
        const meta = (
          await learner.get("/training/hazard-perception").expect(200)
        ).body;
        assert.equal(meta.course.type, "hunt");
        assert.equal(meta.course.areaCount, 8);
        assert.equal(meta.course.taskCount, 5);
        assert.equal(meta.course.quizSeconds, 20);
        assert.equal(meta.course.areas, undefined);
        assert.equal(meta.course.tasks, undefined);
        assert.equal(meta.course.questions, undefined);
        assert.equal(JSON.stringify(meta).includes("correctId"), false);
        assert.equal(
          meta.course.objects.some((o) => "isHazard" in o),
          false,
        );
        assert.equal(
          (await learner.get("/me/training")).body.modules.filter(
            (m) => m.assessmentAvailable,
          ).length,
          3,
        );
        await learner.get("/training/unsafe-acts").expect(404);
        await learner
          .post("/training/hazard-perception/start", { acknowledged: false })
          .expect(422);
      },
    );
    await t.test(
      "legacy results remain intact and three independent open attempts are supported",
      async () => {
        for (const old of legacy) {
          const r = (await learner.get(route(old._id)).expect(200)).body;
          assert.equal(r.attempt.result.score, old.score);
          assert.equal(r.attempt.completedAt, legacyDate.toISOString());
          assert.equal(r.attempt.result.review.length, 10);
          await learner
            .post(`/training/${old.moduleKey}/start`, { acknowledged: true })
            .expect(200);
        }
        const r = await Promise.all([
          learner.post("/training/hazard-perception/start", {
            acknowledged: true,
          }),
          learner.post("/training/hazard-perception/start", {
            acknowledged: true,
          }),
        ]);
        r.forEach((x) => assert.equal(x.status, 200));
        id = r[0].body.attempt.id;
        assert.equal(id, r[1].body.attempt.id);
        const active = (await learner.get("/me/training")).body.activeTraining;
        assert.equal(Object.keys(active).length, 3);
        await learner
          .post(route(active["manual-handling"].id) + "/classify", {
            objectId: "area-a",
            flagged: true,
          })
          .expect(409);
        await other.get(route(id)).expect(404);
        await other
          .post(route(id) + "/inspect", { objectId: "area-a" })
          .expect(404);
      },
    );
    await t.test(
      "inspection is free, free-order, repeatable and required before classification",
      async () => {
        await learner
          .post(route(id) + "/classify", { objectId: "area-a", flagged: true })
          .expect(409);
        await learner
          .post(route(id) + "/inspect", { objectId: "area-z" })
          .expect(404);
        for (let n = 0; n < 3; n++) {
          const inspected = (
            await learner
              .post(route(id) + "/inspect", { objectId: safe[0].id })
              .expect(200)
          ).body;
          assert.equal(inspected.attempt.areasReviewed, 0);
          assert.equal(inspected.attempt.falseFlagCount, 0);
          assert.equal(inspected.attempt.activityScore, 0);
          assert.ok(inspected.attempt.inspection.observation);
          assert.equal(inspected.attempt.inspection.classification, null);
          assert.equal(inspected.attempt.task, null);
        }
        assert.equal((await TrainingAttempt.findById(id)).inspected.length, 1);
        await learner
          .post(route(id) + "/classify", {
            objectId: safe[0].id,
            flagged: true,
            score: 100,
          })
          .expect(422);
        await learner
          .post(route(id) + "/classify", {
            objectId: safe[0].id,
            flagged: "false",
          })
          .expect(422);
      },
    );
    await t.test(
      "an incorrect safe-area flag costs two once; duplicate and changed submissions cannot alter it",
      async () => {
        const first = (
          await learner
            .post(route(id) + "/classify", {
              objectId: safe[0].id,
              flagged: true,
            })
            .expect(200)
        ).body;
        assert.equal(first.feedback.points, -2);
        assert.equal(first.attempt.falseFlagCount, 1);
        assert.equal(first.attempt.activityScore, 0);
        const replies = await Promise.all([
          learner.post(route(id) + "/classify", {
            objectId: safe[0].id,
            flagged: true,
          }),
          learner.post(route(id) + "/classify", {
            objectId: safe[0].id,
            flagged: false,
          }),
        ]);
        for (const r of replies) {
          assert.equal(r.status, 200);
          assert.equal(r.body.attempt.falseFlagCount, 1);
          assert.equal(r.body.feedback.correct, false);
        }
        assert.equal(
          (await TrainingAttempt.findById(id)).classifications.length,
          1,
        );
      },
    );
    await t.test(
      "a missed hazard can be learned from but cannot regain identification marks",
      async () => {
        const task = c.tasks.find((x) => x.objectId === "area-e");
        await learner
          .post(route(id) + "/inspect", { objectId: task.objectId })
          .expect(200);
        await learner
          .post(route(id) + "/activity-answer", {
            taskId: task.id,
            optionId: task.correctId,
          })
          .expect(409);
        const judged = (
          await learner
            .post(route(id) + "/classify", {
              objectId: task.objectId,
              flagged: false,
            })
            .expect(200)
        ).body;
        assert.equal(judged.feedback.points, 0);
        assert.equal(judged.feedback.isHazard, true);
        assert.equal(judged.attempt.task.id, task.id);
        const answered = (
          await learner
            .post(route(id) + "/activity-answer", {
              taskId: task.id,
              optionId: task.correctId,
            })
            .expect(200)
        ).body;
        assert.equal(answered.feedback.points, 7);
        assert.equal(answered.feedback.identificationPoints, 0);
        assert.equal(answered.feedback.responsePoints, 7);
        assert.equal(answered.attempt.activityScore, 5);
        const replay = (
          await learner
            .post(route(id) + "/classify", {
              objectId: task.objectId,
              flagged: true,
            })
            .expect(200)
        ).body;
        assert.equal(replay.feedback.correct, false);
        assert.equal(replay.attempt.activityScore, 5);
      },
    );
    await t.test(
      "all eight judgements and five controls are required; honest partial marks total 52/70",
      async () => {
        for (const task of c.tasks
          .filter((x) => x.objectId !== "area-e")
          .reverse()) {
          await learner
            .post(route(id) + "/inspect", { objectId: task.objectId })
            .expect(200);
          await learner
            .post(route(id) + "/classify", {
              objectId: task.objectId,
              flagged: true,
            })
            .expect(200);
          await learner
            .post(route(id) + "/activity-answer", {
              taskId: task.id,
              optionId:
                task.objectId === "area-c"
                  ? task.options.find((o) => o.id !== task.correctId).id
                  : task.correctId,
            })
            .expect(200);
        }
        let state = (await learner.get(route(id))).body.attempt;
        assert.equal(state.activityDone, 5);
        assert.equal(state.areasReviewed, 6);
        assert.equal(state.phase, "activity");
        await learner
          .post(route(id) + "/quiz/next", { afterQuestionId: null })
          .expect(409);
        for (const [i, o] of safe.slice(1).entries()) {
          await learner
            .post(route(id) + "/inspect", { objectId: o.id })
            .expect(200);
          await learner
            .post(route(id) + "/classify", { objectId: o.id, flagged: i === 0 })
            .expect(200);
        }
        state = (await learner.get(route(id))).body.attempt;
        assert.equal(state.phase, "quiz-ready");
        assert.equal(state.areasReviewed, 8);
        assert.equal(state.activityScore, 52);
        assert.equal(state.activityBreakdown.identificationScore, 28);
        assert.equal(state.activityBreakdown.responseScore, 28);
        assert.equal(state.activityBreakdown.falseFlagPenalty, 4);
      },
    );
    await t.test(
      "server deadlines, no reset/replay points, and a genuine 70/100 pass",
      async () => {
        let state = (
          await learner
            .post(route(id) + "/quiz/next", { afterQuestionId: null })
            .expect(200)
        ).body;
        const q = state.attempt.currentQuestion;
        const early = (
          await learner
            .post(route(id) + "/quiz/answer", {
              questionId: q.id,
              optionId: null,
              timeout: true,
            })
            .expect(200)
        ).body;
        assert.equal(early.attempt.currentQuestion.deadline, q.deadline);
        assert.equal(
          (await learner.get(route(id))).body.attempt.currentQuestion.deadline,
          q.deadline,
        );
        await learner
          .post(route(id) + "/quiz/answer", {
            questionId: "mh-q1",
            optionId: "choice-1",
          })
          .expect(409);
        await TrainingAttempt.updateOne(
          { _id: id },
          { $set: { questionDeadline: new Date(Date.now() - 1) } },
        );
        state = (
          await learner
            .post(route(id) + "/quiz/answer", {
              questionId: q.id,
              optionId: c.questions.find((x) => x.id === q.id).correctId,
            })
            .expect(200)
        ).body;
        assert.equal(state.feedback.timedOut, true);
        assert.equal(state.feedback.points, 0);
        for (let n = 1; n < 5; n++) {
          state = (
            await learner
              .post(route(id) + "/quiz/next", {
                afterQuestionId: state.attempt.lastQuizQuestionId,
              })
              .expect(200)
          ).body;
          const next = c.questions.find(
            (q) => q.id === state.attempt.currentQuestion.id,
          );
          state = (
            await learner
              .post(route(id) + "/quiz/answer", {
                questionId: next.id,
                optionId: n < 4 ? next.correctId : null,
              })
              .expect(200)
          ).body;
        }
        assert.equal(state.attempt.result.score, 70);
        assert.equal(state.attempt.result.activityScore, 52);
        assert.equal(state.attempt.result.quizScore, 18);
        assert.equal(state.attempt.result.stars, 2);
        assert.equal(state.attempt.result.inspectionReview.length, 8);
        assert.equal(state.attempt.result.review.length, 10);
        const progress = (await learner.get("/me/training")).body.progress;
        assert.equal(progress.modules[0].score, 94);
        assert.equal(progress.modules[1].score, 88);
        assert.equal(progress.modules[2].score, 70);
        assert.equal(progress.eligible, true);
        assert.equal(progress.overallScore, 84);
        const detail = (await admin.get(`/admin/employees/${user._id}`)).body;
        assert.equal(detail.progress.modules[2].activityScore, 52);
        const certificateState = (
          await learner.get("/me/certificate").expect(200)
        ).body;
        assert.equal(certificateState.certificate, null);
        await learner.get("/me/certificate/pdf").expect(409);
      },
    );
    await t.test(
      "retakes keep the best and correctly distinguish 84 Pass from 85 Excellent",
      async () => {
        const cases = [
          {
            walk: {
              missed: c.tasks.map((t) => t.objectId),
              wrongControls: c.tasks.map((t) => t.objectId),
              falseFlags: safe.map((o) => o.id),
            },
            quiz: 0,
            score: 0,
            best: 70,
            stars: 1,
          },
          {
            walk: { missed: ["area-a"], falseFlags: [safe[0].id] },
            quiz: 4,
            score: 85,
            best: 85,
            stars: 3,
          },
          {
            walk: {
              wrongControls: ["area-a", "area-b"],
              falseFlags: [safe[0].id],
            },
            quiz: 5,
            score: 84,
            best: 85,
            stars: 2,
          },
          { walk: {}, quiz: 5, score: 100, best: 100, stars: 3 },
        ];
        for (const example of cases) {
          const next = (
            await learner
              .post("/training/hazard-perception/start", { acknowledged: true })
              .expect(200)
          ).body.attempt.id;
          await completeWalk(learner, next, example.walk);
          const result = await completeQuiz(learner, next, example.quiz);
          assert.equal(result.attempt.result.score, example.score);
          assert.equal(result.bestScore, example.best);
          assert.equal(result.attempt.result.stars, example.stars);
        }
        const rows = await Progress.find({ employeeId: user._id }).lean();
        assert.equal(rows.length, 3);
        for (const old of legacy) {
          const row = rows.find((r) => r.moduleKey === old.moduleKey);
          assert.equal(row.score, old.score);
          assert.equal(row.attempts, 1);
          assert.equal(String(row.bestAttemptId), String(old._id));
          assert.equal(row.assessedAt.toISOString(), legacyDate.toISOString());
        }
        assert.equal(
          rows.find((r) => r.moduleKey === "hazard-perception").attempts,
          5,
        );
        assert.equal(
          progressSummary([
            { moduleKey: "manual-handling", score: 94 },
            { moduleKey: "working-at-height", score: 88 },
            { moduleKey: "hazard-perception", score: 69 },
          ]).eligible,
          false,
        );
      },
    );
    await t.test(
      "a sample Hazard score cannot override the first real assessment",
      async () => {
        const demo = client(app);
        await demo.login("anisha.g", "DemoOnly!2026");
        const next = (
          await demo
            .post("/training/hazard-perception/start", { acknowledged: true })
            .expect(200)
        ).body.attempt.id;
        await completeWalk(demo, next, {
          missed: c.tasks.map((t) => t.objectId),
          wrongControls: c.tasks.map((t) => t.objectId),
        });
        const result = await completeQuiz(demo, next, 0);
        assert.equal(result.bestScore, 0);
        const p = (await demo.get("/me/training")).body.progress;
        assert.equal(p.modules[2].source, "assessment");
        assert.equal(p.modules[2].score, 0);
        assert.equal(p.modules[0].source, "demo");
        assert.equal(p.modules[1].source, "demo");
      },
    );
    await t.test(
      "deactivation preserves, reactivation restores, deletion removes all module attempts",
      async () => {
        await admin
          .patch(`/admin/employees/${user._id}/status`, { status: "inactive" })
          .expect(200);
        await learner.get(route(id)).expect(401);
        await admin
          .patch(`/admin/employees/${user._id}/status`, { status: "active" })
          .expect(200);
        await learner.login("hazard.tester");
        assert.equal(
          (await learner.get("/me/training")).body.progress.modules[2].score,
          100,
        );
        await admin
          .delete(`/admin/employees/${user._id}`, {
            confirmation: "hazard.tester",
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
      },
    );
  },
);
