import express from "express";
import { completionStatus } from "./completion.js";
import { attemptPercent } from "./progress-percent.js";
import mongoose from "mongoose";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { Module, Progress, User, Audit } from "./models.js";
import { TrainingAttempt } from "./training-models.js";
import {
  COURSES,
  COURSE_VERSION,
  REFERENCES,
  courseOverview,
  questionScore,
  classificationFor,
  AVAILABLE_MODULE_KEYS,
  LEVEL_COUNT,
  QUESTION_TIME_LIMIT_SECONDS,
  PASS_MARK,
} from "./training-content.js";

// Resolve content using the stored module key, never a client-supplied score.
function getCourse(key) {
  if (!AVAILABLE_MODULE_KEYS.includes(key))
    fail(404, "This module is not available yet.");
  return COURSES[key];
}
const fail = (status, message, code) => {
  throw Object.assign(new Error(message), { status, code });
};
const shuffled = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const entryFor = (a, questionId) => a.questions.find((x) => x.questionId === questionId);
const round1 = (n) => Math.round(n * 10) / 10;

// The current question of the active level: the first not-yet-correct question
// in that level's order. Null when the level's quiz is complete.
function currentQuestion(a, course) {
  if (a.phase !== "quiz") return null;
  const order = a.levelOrders[a.levelIndex] || [];
  for (const id of order) {
    const entry = entryFor(a, id);
    if (!entry || !entry.correctAt) {
      const q = course.levels[a.levelIndex].questions.find((x) => x.id === id);
      return { q, entry, index: order.indexOf(id) };
    }
  }
  return null;
}
function levelQuizComplete(a, course, levelIndex) {
  const order = a.levelOrders[levelIndex] || [];
  return (
    order.length > 0 &&
    order.every((id) => entryFor(a, id)?.correctAt)
  );
}
// Recompute the module result from stored selections against the frozen course.
export function calculateResult(a) {
  const course = getCourse(a.moduleKey);
  const allQuestions = course.levels.flatMap((l, li) =>
    l.questions.map((q) => ({ ...q, levelIndex: li, levelTitle: l.title, levelKey: l.key })),
  );
  const perLevel = course.levels.map((l) => {
    const qs = l.questions.map((q) => {
      const e = entryFor(a, q.id);
      return { id: q.id, score: e ? questionScore(e.wrongAttempts) : 0, correct: Boolean(e?.correctAt) };
    });
    const average = round1(
      qs.reduce((n, q) => n + q.score, 0) / Math.max(1, qs.length),
    );
    return { key: l.key, title: l.title, average, questions: qs };
  });
  const score = round1(
    allQuestions.reduce((n, q) => {
      const e = entryFor(a, q.id);
      return n + (e ? questionScore(e.wrongAttempts) : 0);
    }, 0) / allQuestions.length,
  );
  const stars = score >= 85 ? 3 : score >= 70 ? 2 : 1;
  const passed = score >= 70;
  const classification = classificationFor(score);
  const feedback = passed
    ? score >= 85
      ? "Excellent work. You answered cleanly across all three levels — keep applying the same habit of assessing, planning and reporting in the real warehouse."
      : "You passed this module. Review the questions you needed a second attempt on, and keep using the guides and procedures that get you to a clean score."
    : "This attempt needs a retake. Several questions took multiple attempts. Revisit the study material for each level, then try again — your earlier genuine best is kept either way.";
  const review = allQuestions.map((q) => {
    const e = entryFor(a, q.id);
    const selected = e?.lastOptionId
      ? q.options.find((o) => o.id === e.lastOptionId)?.text || null
      : null;
    return {
      questionId: q.id,
      levelTitle: q.levelTitle,
      title: q.prompt,
      selected,
      correctAnswer: q.options.find((o) => o.id === q.correctId).text,
      explanation: q.explanation,
      reference: REFERENCES[q.reference],
      wrongAttempts: e?.wrongAttempts ?? 0,
      hintUsed: Boolean(e?.hintUsed),
      score: e ? questionScore(e.wrongAttempts) : 0,
    };
  });
  return { score, passed, stars, classification, feedback, perLevel, review };
}
function safeAttempt(a) {
  const course = getCourse(a.moduleKey);
  // Attempts written by an older release (fewer questions per level) cannot
  // be continued in the current flow; they are flagged legacy.
  const legacy =
    (a.version || COURSE_VERSION) !== (course.version || COURSE_VERSION);
  const cur = currentQuestion(a, course);
  const optionOrder = (q) =>
    a.optionOrders.get(q.id) || q.options.map((o) => o.id);
  const levels = course.levels.map((l, li) => {
    const qs = l.questions.map((q) => {
      const e = entryFor(a, q.id);
      return {
        id: q.id,
        done: Boolean(e?.correctAt),
        wrongAttempts: e?.wrongAttempts ?? 0,
        hintUsed: Boolean(e?.hintUsed),
      };
    });
    return {
      index: li,
      key: l.key,
      title: l.title,
      summary: l.summary,
      quizComplete: levelQuizComplete(a, course, li),
      questions: qs,
    };
  });
  return {
    id: String(a._id),
    moduleKey: a.moduleKey,
    phase: a.phase,
    open: Boolean(a.open),
    levelIndex: a.levelIndex,
    levelCount: LEVEL_COUNT,
    createdAt: a.createdAt,
    completedAt: a.completedAt,
    score: a.score ?? null,
    levels,
    // Live completion percentage for the bar at the top of the module.
    percent: attemptPercent(a, course),
    levelQuizComplete: levelQuizComplete(a, course, a.levelIndex),
    currentQuestion:
      cur && !legacy
        ? {
            id: cur.q.id,
            prompt: cur.q.prompt,
            options: optionOrder(cur.q).map(
              (id) => cur.q.options.find((o) => o.id === id),
            ),
            number: cur.index + 1,
            levelIndex: a.levelIndex,
            wrongSoFar: cur.entry?.wrongAttempts ?? 0,
            timeLimit: QUESTION_TIME_LIMIT_SECONDS,
            openedAt: a.currentOpenedAt || null,
          }
        : null,
    legacy: Boolean(legacy),
    result:
      a.phase === "completed" && Array.isArray(a.levelOrders)
        ? legacy
          ? { score: a.score ?? null, legacy: true }
          : { ...calculateResult(a) }
        : null,
  };
}
async function saveBest(a) {
  if (a.phase !== "completed") return;
  if (!(await User.exists({ _id: a.employeeId, role: "employee" })))
    fail(404, "Employee no longer exists.");
  const query = { employeeId: a.employeeId, moduleKey: a.moduleKey };
  const count = await TrainingAttempt.countDocuments({
    ...query,
    phase: "completed",
  });
  const best = {
    score: a.score,
    bestAttemptId: a._id,
    assessedAt: a.completedAt,
    source: "assessment",
  };
  try {
    await Progress.updateOne(
      query,
      { $setOnInsert: { ...query, ...best, attempts: count } },
      { upsert: true },
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
  // Demonstration scores are replaced, not allowed to override a real first attempt.
  await Progress.updateOne(
    {
      ...query,
      $or: [{ source: { $ne: "assessment" } }, { bestAttemptId: null }],
    },
    { $set: { ...best, attempts: count } },
  );
  // A later assessed retake can only improve the recorded best score.
  await Progress.updateOne(
    { ...query, source: "assessment", score: { $lt: a.score } },
    { $set: best },
  );
  await Progress.updateOne(query, { $max: { attempts: count } });
  await Progress.updateOne(
    {
      ...query,
      $or: [
        { lastAssessedAt: null },
        { lastAssessedAt: { $lt: a.completedAt } },
      ],
    },
    { $set: { lastScore: a.score, lastAssessedAt: a.completedAt } },
  );
  const claimed = await TrainingAttempt.updateOne(
    { _id: a._id, recordedAt: null },
    { $set: { recordedAt: new Date() } },
  );
  if (claimed.modifiedCount) {
    const user = await User.findById(a.employeeId).lean();
    if (user)
      await Audit.create({
        actorId: user._id,
        actorName: `${user.firstName} ${user.lastName}`,
        action: `completed the ${getCourse(a.moduleKey).title} module journey`,
        subject: `${a.score}/100 · ${a.score >= 70 ? "Pass" : "Retake"}`,
      });
  }
}
// Optimistic concurrency works across tabs/processes; replayed answers are idempotent.
async function changeAttempt(req, operation = () => ({})) {
  if (!mongoose.isValidObjectId(req.params.id)) fail(404, "Attempt not found.");
  for (let n = 0; n < 4; n++) {
    const a = await TrainingAttempt.findOne({
      _id: req.params.id,
      employeeId: req.user._id,
      moduleKey: { $in: AVAILABLE_MODULE_KEYS },
    });
    if (!a) fail(404, "Attempt not found.");
    const extra = await operation(a, getCourse(a.moduleKey));
    try {
      if (a.isModified()) await a.save();
      await saveBest(a);
      const best = await Progress.findOne({
        employeeId: a.employeeId,
        moduleKey: a.moduleKey,
      }).lean();
      return {
        attempt: safeAttempt(a),
        bestScore:
          best?.source === "assessment" && best.bestAttemptId
            ? best.score
            : null,
        ...(a.phase === "completed"
          ? { completion: await completionStatus(req.user) }
          : {}),
        serverNow: Date.now(),
        ...extra,
      };
    } catch (e) {
      if (e.name !== "VersionError") throw e;
    }
  }
  fail(409, "This attempt changed in another tab. Reload it to continue.");
}
export async function activeTraining(employeeId) {
  const active = await TrainingAttempt.find({
    employeeId,
    moduleKey: { $in: AVAILABLE_MODULE_KEYS },
    open: true,
  })
    .select("_id phase moduleKey")
    .lean();
  return Object.fromEntries(
    active.map((a) => [a.moduleKey, { id: String(a._id), phase: a.phase }]),
  );
}
export function createTrainingRouter() {
  const router = express.Router();
  router.use((req, res, next) =>
    req.user.role === "employee"
      ? next()
      : next(
          Object.assign(
            new Error("Training is available to employee accounts."),
            { status: 403 },
          ),
        ),
  );
  // Fun quiz: ten random questions drawn across all three modules, answered
  // for practice only — never recorded against an attempt or a certificate.
  // (Registered before /:moduleKey so the path is not swallowed.)
  const FUN_QUIZ_SIZE = 10;
  const funQuestionPool = Object.entries(COURSES).flatMap(([moduleKey, c]) =>
    c.levels.flatMap((l) =>
      l.questions.map((q) => ({ q, moduleKey })),
    ),
  );
  router.get("/fun-quiz", (req, res) => {
    const picked = shuffled(funQuestionPool).slice(0, FUN_QUIZ_SIZE);
    res.json({
      questionTimeLimit: QUESTION_TIME_LIMIT_SECONDS,
      questions: picked.map(({ q }) => ({
        id: q.id,
        prompt: q.prompt,
        options: shuffled(q.options.map((o) => o.id)).map((id) =>
          q.options.find((o) => o.id === id),
        ),
      })),
      serverNow: Date.now(),
    });
  });
  router.post("/fun-quiz/answer", (req, res) => {
    const input = z
      .object({
        questionId: z.string().min(1).max(40),
        optionId: z.string().min(1).max(30),
      })
      .strict()
      .parse(req.body);
    const found = funQuestionPool.find((x) => x.q.id === input.questionId);
    if (!found) fail(404, "This question is not part of the fun quiz.");
    const q = found.q;
    if (!q.options.some((o) => o.id === input.optionId))
      fail(422, "Choose one of the displayed answers.");
    const correct = input.optionId === q.correctId;
    res.json({
      correct,
      correctText: q.options.find((o) => o.id === q.correctId).text,
      explanation: q.explanation,
      reference: REFERENCES[q.reference],
      serverNow: Date.now(),
    });
  });
  router.get("/:moduleKey", async (req, res) => {
    const KEY = req.params.moduleKey;
    const course = getCourse(KEY);
    const [module, best, active, history] = await Promise.all([
      Module.findOne({ key: KEY }).populate("trainerId").lean(),
      Progress.findOne({ employeeId: req.user._id, moduleKey: KEY }).lean(),
      TrainingAttempt.findOne({
        employeeId: req.user._id,
        moduleKey: KEY,
        open: true,
      }).lean(),
      TrainingAttempt.find({
        employeeId: req.user._id,
        moduleKey: KEY,
        phase: "completed",
      })
        .sort({ completedAt: -1 })
        .limit(10)
        .lean(),
    ]);
    const trainer =
      module?.trainerId?.status === "active" ? module.trainerId : null;
    res.json({
      course: courseOverview(KEY),
      trainer: trainer
        ? {
            nickname: trainer.nickname,
            imageUrl: trainer.imageUrl,
            introduction: trainer.introduction,
          }
        : null,
      bestScore:
        best?.source === "assessment" && best.bestAttemptId ? best.score : null,
      activeAttemptId: active ? String(active._id) : null,
      // How much of this module the employee has finished (0-100), shown at
      // the top of the module page. A passed module always reports 100.
      percent:
        (best?.score ?? 0) >= PASS_MARK
          ? 100
          : attemptPercent(active, course),
      history: history
        .filter((a) => Array.isArray(a.levelOrders))
        .map((a) => {
          // Legacy completed attempts predate the current question set, so
          // their frozen course no longer matches; show the stored score.
          const legacy =
            (a.version || COURSE_VERSION) !== (course.version || COURSE_VERSION);
          if (legacy) {
            return {
              id: String(a._id),
              completedAt: a.completedAt,
              score: a.score ?? null,
              passed: (a.score ?? 0) >= PASS_MARK,
              stars: null,
              classification: "Previous format",
            };
          }
          const r = calculateResult(a);
          return {
            id: String(a._id),
            completedAt: a.completedAt,
            score: r.score,
            passed: r.passed,
            stars: r.stars,
            classification: r.classification,
          };
      }),
      serverNow: Date.now(),
    });
  });
  router.post("/:moduleKey/start", async (req, res) => {
    const KEY = req.params.moduleKey;
    const course = getCourse(KEY);
    z.object({ acknowledged: z.literal(true) })
      .strict()
      .parse(req.body);
    let a = await TrainingAttempt.findOne({
      employeeId: req.user._id,
      moduleKey: KEY,
      open: true,
    });
    // Attempts from an older release (pre-journey shape, or an earlier
    // question format) can no longer be continued, so retire them and start
    // a fresh journey in the current format.
    const NEW_PHASES = ["intro", "study", "quiz", "completed"];
    const storedVersion = a ? a.version || COURSE_VERSION : null;
    const currentVersion = course.version || COURSE_VERSION;
    if (
      a &&
      (!Array.isArray(a.levelOrders) ||
        !NEW_PHASES.includes(a.phase) ||
        storedVersion !== currentVersion)
    ) {
      await TrainingAttempt.updateOne(
        { _id: a._id },
        { $set: { open: false } },
      );
      a = null;
    }
    if (!a) {
      const levelOrders = course.levels.map((l) =>
        shuffled(l.questions.map((q) => q.id)),
      );
      const optionOrders = Object.fromEntries(
        course.levels
          .flatMap((l) => l.questions)
          .map((q) => [q.id, shuffled(q.options.map((o) => o.id))]),
      );
      try {
        a = await TrainingAttempt.create({
          employeeId: req.user._id,
          moduleKey: KEY,
          version: course.version || COURSE_VERSION,
          levelOrders,
          optionOrders,
        });
      } catch (e) {
        if (e.code !== 11000) throw e;
        a = await TrainingAttempt.findOne({
          employeeId: req.user._id,
          moduleKey: KEY,
          open: true,
        });
        if (!a) throw e;
      }
    }
    req.params.id = String(a._id);
    res.json(await changeAttempt(req));
  });
  router.get("/attempts/:id", async (req, res) =>
    res.json(await changeAttempt(req)),
  );
  router.post("/attempts/:id/advance", async (req, res) => {
    res.json(
      await changeAttempt(req, (a, course) => {
        if (a.phase === "completed")
          fail(409, "This module journey is already complete.");
        if (a.phase === "intro") {
          a.phase = "study";
          a.levelIndex = 0;
          a.currentOpenedAt = null;
          return {};
        }
        if (a.phase === "study") {
          a.phase = "quiz";
          a.currentOpenedAt = new Date();
          return {};
        }
        if (a.phase === "quiz") {
          if (!levelQuizComplete(a, course, a.levelIndex))
            fail(409, "Answer every question in this level correctly to continue.");
          if (a.levelIndex < LEVEL_COUNT - 1) {
            a.levelIndex += 1;
            a.phase = "study";
            a.currentOpenedAt = null;
          } else {
            const r = calculateResult(a);
            Object.assign(a, {
              phase: "completed",
              open: false,
              completedAt: new Date(),
              score: r.score,
            });
            a.currentOpenedAt = null;
          }
          return {};
        }
        fail(409, "This attempt cannot advance from this stage.");
      }),
    );
  });
  router.post("/attempts/:id/quiz/answer", async (req, res) => {
    const input = z
      .object({
        questionId: z.string().min(1).max(40),
        optionId: z.string().min(1).max(30),
      })
      .strict()
      .parse(req.body);
    res.json(
      await changeAttempt(req, (a, course) => {
        if (a.phase !== "quiz")
          fail(409, "The level quiz is not open.");
        const cur = currentQuestion(a, course);
        if (!cur)
          fail(409, "This level's quiz is already complete. Continue to the next level.");
        if (cur.q.id !== input.questionId)
          fail(409, "This is not the current question. Reload to continue.");
        if (!cur.q.options.some((o) => o.id === input.optionId))
          fail(422, "Choose one of the displayed answers.");
        // Server-side time limit: the window starts when the question is
        // opened (and after every attempt/timeout), so a late answer — even
        // a correct one — counts as a timeout and restarts the window.
        const openedMs = a.currentOpenedAt
          ? a.currentOpenedAt.getTime()
          : null;
        const timedOut =
          openedMs !== null &&
          Date.now() - openedMs > QUESTION_TIME_LIMIT_SECONDS * 1000;
        // Push copies plain objects into subdocuments, so re-fetch the stored
        // subdocument before mutating it (mutating the original is lost).
        let entry = entryFor(a, input.questionId);
        if (!entry) {
          a.questions.push({
            questionId: input.questionId,
            wrongAttempts: 0,
            timeouts: 0,
            hintUsed: false,
            lastOptionId: null,
            correctAt: null,
          });
          entry = entryFor(a, input.questionId);
        }
        const correct = !timedOut && input.optionId === cur.q.correctId;
        entry.lastOptionId = input.optionId;
        if (timedOut) entry.timeouts += 1;
        if (correct) entry.correctAt = new Date();
        else entry.wrongAttempts += 1;
        a.currentOpenedAt = new Date();
        const levelDone = levelQuizComplete(a, course, a.levelIndex);
        const feedback = {
          questionId: input.questionId,
          title: cur.q.prompt,
          correct,
          timedOut,
          selected: cur.q.options.find((o) => o.id === input.optionId).text,
          correctAnswer: cur.q.options.find((o) => o.id === cur.q.correctId).text,
          explanation: cur.q.explanation,
          reference: REFERENCES[cur.q.reference],
          questionScore: questionScore(entry.wrongAttempts),
          wrongAttempts: entry.wrongAttempts,
          levelDone,
        };
        return { feedback };
      }),
    );
  });
  // Client-side countdown fired: charge the attempt, restart the window.
  router.post("/attempts/:id/quiz/timeout", async (req, res) => {
    const input = z
      .object({ questionId: z.string().min(1).max(40) })
      .strict()
      .parse(req.body);
    res.json(
      await changeAttempt(req, (a, course) => {
        if (a.phase !== "quiz")
          fail(409, "The level quiz is not open.");
        const cur = currentQuestion(a, course);
        if (!cur)
          fail(409, "This level's quiz is already complete. Continue to the next level.");
        if (cur.q.id !== input.questionId)
          fail(409, "This is not the current question. Reload to continue.");
        let entry = entryFor(a, input.questionId);
        if (!entry) {
          a.questions.push({
            questionId: input.questionId,
            wrongAttempts: 0,
            timeouts: 0,
            hintUsed: false,
            lastOptionId: null,
            correctAt: null,
          });
          entry = entryFor(a, input.questionId);
        }
        entry.wrongAttempts += 1;
        entry.timeouts += 1;
        a.currentOpenedAt = new Date();
        return {
          feedback: {
            questionId: input.questionId,
            title: cur.q.prompt,
            correct: false,
            timedOut: true,
            selected: null,
            correctAnswer: cur.q.options.find((o) => o.id === cur.q.correctId)
              .text,
            explanation: cur.q.explanation,
            reference: REFERENCES[cur.q.reference],
            questionScore: questionScore(entry.wrongAttempts),
            wrongAttempts: entry.wrongAttempts,
            levelDone: levelQuizComplete(a, course, a.levelIndex),
          },
        };
      }),
    );
  });
  router.post("/attempts/:id/hint", async (req, res) => {
    const input = z
      .object({ questionId: z.string().min(1).max(40) })
      .strict()
      .parse(req.body);
    res.json(
      await changeAttempt(req, (a, course) => {
        if (a.phase !== "quiz")
          fail(409, "Hints are available only during a level quiz.");
        const cur = currentQuestion(a, course);
        if (!cur) fail(409, "This level's quiz is already complete.");
        if (cur.q.id !== input.questionId)
          fail(409, "This is not the current question. Reload to continue.");
        let entry = entryFor(a, cur.q.id);
        if (!entry) {
          a.questions.push({
            questionId: cur.q.id,
            wrongAttempts: 0,
            hintUsed: false,
            lastOptionId: null,
            correctAt: null,
          });
          entry = entryFor(a, cur.q.id);
        }
        entry.hintUsed = true;
        return { hint: cur.q.hint };
      }),
    );
  });
  return router;
}
