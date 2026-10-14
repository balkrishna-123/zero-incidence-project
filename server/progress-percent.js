// Module completion percentages and promotion eligibility (Oct 2026 revision).
//
// "How much of this module has the employee finished?" is derived from the
// immutable attempt bookkeeping, so it can never be spoofed from the client:
// the journey is Introduction -> (Level study -> Level quiz) x3 -> Completed.
// Every unit below is one share of the module:
//   1 introduction unit, 1 study unit per level, 1 unit per question
//   (counted once answered correctly) and 1 completion unit.
// A passed module (Progress score >= 70) always reports 100%, and an
// in-progress attempt never reports 100% before the final phase.
import { COURSES } from "./training-content.js";
import { TrainingAttempt } from "./training-models.js";
import { Module, Progress } from "./models.js";
import { MODULE_KEYS, PROMOTION } from "./config.js";

export const PASS_MARK = 70;

export function attemptPercent(attempt, course) {
  if (!attempt || !course) return 0;
  if (attempt.phase === "completed") return 100;
  const levels = course.levels || [];
  const totalQuestions = levels.reduce((n, l) => n + l.questions.length, 0);
  const totalUnits = 1 + levels.length + totalQuestions + 1;
  let done = 0;
  if (attempt.phase !== "intro") done += 1; // introduction acknowledged
  const answered = new Set(
    (attempt.questions || [])
      .filter((q) => q.correctAt)
      .map((q) => q.questionId),
  );
  levels.forEach((level, i) => {
    const reachedQuiz =
      attempt.levelIndex > i ||
      (attempt.levelIndex === i && attempt.phase === "quiz");
    if (reachedQuiz) done += 1; // study material for this level was worked through
    for (const q of level.questions) if (answered.has(q.id)) done += 1;
  });
  return Math.min(99, Math.round((done / totalUnits) * 100));
}

// Best percentage per module for one employee, from attempts plus passes.
export function percentMapFromRows(attempts, progressRows) {
  return Object.fromEntries(
    MODULE_KEYS.map((key) => {
      const passed =
        (progressRows.find((p) => p.moduleKey === key)?.score ?? 0) >=
        PASS_MARK;
      if (passed) return [key, 100];
      const course = COURSES[key];
      const best = (attempts || [])
        .filter((a) => a.moduleKey === key)
        .reduce((m, a) => Math.max(m, attemptPercent(a, course)), 0);
      return [key, best];
    }),
  );
}

export const overallPercent = (map) =>
  Math.round(
    MODULE_KEYS.reduce((sum, key) => sum + (map[key] || 0), 0) /
      MODULE_KEYS.length,
  );

export async function modulePercentMap(employeeId) {
  const [attempts, rows] = await Promise.all([
    TrainingAttempt.find({ employeeId }).lean(),
    Progress.find({ employeeId }).lean(),
  ]);
  return percentMapFromRows(attempts, rows);
}

// Batch variant for the trainer/administrator rosters: one query each, then
// grouped in memory so listing 100 employees costs two finds.
export async function modulePercentMaps(employeeIds) {
  if (!employeeIds.length) return new Map();
  const [attempts, rows] = await Promise.all([
    TrainingAttempt.find({ employeeId: { $in: employeeIds } }).lean(),
    Progress.find({ employeeId: { $in: employeeIds } }).lean(),
  ]);
  const byEmployee = new Map();
  for (const id of employeeIds) byEmployee.set(String(id), { attempts: [], rows: [] });
  for (const a of attempts) {
    const bucket = byEmployee.get(String(a.employeeId));
    if (bucket) bucket.attempts.push(a);
  }
  for (const p of rows) {
    const bucket = byEmployee.get(String(p.employeeId));
    if (bucket) bucket.rows.push(p);
  }
  const out = new Map();
  for (const [id, bucket] of byEmployee)
    out.set(id, percentMapFromRows(bucket.attempts, bucket.rows));
  return out;
}

// Employees this trainer has guided to full certification: they passed all
// three modules and at least one of those passes sits in a module currently
// assigned to this trainer. Module guides are assigned by the administrator,
// so "guided" follows the current assignment.
export async function certifiedEmployeesForTrainer(trainerId) {
  const guided = (await Module.find({ trainerId }).select("key").lean()).map(
    (m) => m.key,
  );
  if (!guided.length) return 0;
  const passedRows = await Progress.find({ score: { $gte: PASS_MARK } })
    .select("employeeId moduleKey")
    .lean();
  const byEmployee = new Map();
  for (const r of passedRows) {
    const id = String(r.employeeId);
    if (!byEmployee.has(id)) byEmployee.set(id, new Set());
    byEmployee.get(id).add(r.moduleKey);
  }
  let count = 0;
  for (const set of byEmployee.values()) {
    const fullyCertified = MODULE_KEYS.every((key) => set.has(key));
    if (fullyCertified && guided.some((key) => set.has(key))) count += 1;
  }
  return count;
}

// Trainer -> administrator eligibility: active status, configured tenure and
// configured number of employees certified under their guidance.
export async function trainerAdminEligibility(trainer) {
  const daysActive = Math.max(
    0,
    Math.floor((Date.now() - new Date(trainer.createdAt).getTime()) / 86400000),
  );
  const certified = await certifiedEmployeesForTrainer(trainer._id);
  const minDays = PROMOTION.adminMinDaysActive;
  const minCertified = PROMOTION.adminMinCertifiedEmployees;
  return {
    eligible:
      trainer.status === "active" &&
      daysActive >= minDays &&
      certified >= minCertified,
    daysActive,
    certified,
    minDays,
    minCertified,
    active: trainer.status === "active",
  };
}
