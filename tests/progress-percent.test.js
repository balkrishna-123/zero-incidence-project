import test from "node:test";
import assert from "node:assert/strict";

const { attemptPercent, percentMapFromRows, overallPercent } = await import(
  "../server/progress-percent.js"
);
const { COURSES } = await import("../server/training-content.js");

const KEY = "manual-handling";
const course = COURSES[KEY];
const questionIds = course.levels.flatMap((l) => l.questions.map((q) => q.id));
const perLevel = course.levels.map((l) => l.questions.length);

const attempt = (over = {}) => ({
  phase: "intro",
  levelIndex: 0,
  questions: [],
  ...over,
});
const answered = (n) =>
  questionIds.slice(0, n).map((id) => ({ questionId: id, correctAt: new Date() }));

test("module completion percent tracks the journey", () => {
  // Not started.
  assert.equal(attemptPercent(attempt(), course), 0);
  // Introduction acknowledged: 1 unit of 1+3+24+1.
  const total = 1 + course.levels.length + questionIds.length + 1;
  assert.equal(attemptPercent(attempt({ phase: "study" }), course), Math.round((1 / total) * 100));
  // Level 1 study done + its questions answered.
  const l1 = attempt({ phase: "quiz", levelIndex: 0, questions: answered(perLevel[0]) });
  assert.equal(
    attemptPercent(l1, course),
    Math.round(((2 + perLevel[0]) / total) * 100),
  );
  // In progress never reports a full 100.
  const nearly = attempt({
    phase: "quiz",
    levelIndex: 2,
    questions: answered(questionIds.length),
  });
  assert.ok(attemptPercent(nearly, course) < 100);
  // Completed is exactly 100.
  assert.equal(attemptPercent(attempt({ phase: "completed" }), course), 100);
});

test("percent maps: passes win, best attempt counts, overall averages", () => {
  const progressRows = [
    { moduleKey: KEY, score: 74 }, // passed -> 100 regardless of attempts
    { moduleKey: "working-at-height", score: 40 }, // failed, no attempt -> 0
  ];
  const attempts = [
    { moduleKey: "hazard-perception", phase: "intro", levelIndex: 0, questions: [] },
    {
      moduleKey: "hazard-perception",
      phase: "study",
      levelIndex: 0,
      questions: [],
    },
  ];
  const map = percentMapFromRows(attempts, progressRows);
  assert.equal(map[KEY], 100);
  assert.equal(map["working-at-height"], 0);
  const hzTotal = 1 + 3 + COURSES["hazard-perception"].levels.reduce((n, l) => n + l.questions.length, 0) + 1;
  assert.equal(map["hazard-perception"], Math.round((1 / hzTotal) * 100));
  assert.equal(overallPercent(map), Math.round((100 + 0 + map["hazard-perception"]) / 3));
});
