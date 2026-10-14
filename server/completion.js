import { createHash, randomBytes } from "node:crypto";
import { User, Progress, Audit } from "./models.js";
import { TrainingAttempt } from "./training-models.js";
import { Certificate } from "./certificate-model.js";
import { MODULE_KEYS } from "./config.js";
import { COURSES, COURSE_VERSION, questionScore } from "./training-content.js";
import { assertCertificateText, certificateDate } from "./certificate-pdf.js";

export const PROGRAM_VERSION = "zero-incident-core-v1";
export const PROGRAM_TITLE = "Warehouse Safety Induction";
const timeZone = process.env.CERTIFICATE_TIME_ZONE || "Asia/Kathmandu";
new Intl.DateTimeFormat("en", { timeZone }); // Fail clearly at startup for an invalid configured zone.
const fail = (status, message, code) => {
  throw Object.assign(new Error(message), { status, code });
};
const same = (a, b) => String(a) === String(b);
const validDate = (d) => d != null && Number.isFinite(new Date(d).getTime());
const date = (d) => (validDate(d) ? new Date(d).toISOString() : null);
const cleanText = (s) =>
  String(s || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const uniqueExact = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  new Set(actual).size === actual.length &&
  actual.every((v) => expected.includes(v));
function stable(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stable);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => [k, stable(value[k])]),
  );
}
const digest = (value) =>
  createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
// Only immutable assessment data is bound. Operational fields such as updatedAt,
// recordedAt, the Mongoose revision and display-only fields are deliberately omitted.
export function evidenceDigest(a) {
  return digest({
    id: String(a._id),
    employeeId: String(a.employeeId),
    moduleKey: a.moduleKey,
    version: a.version,
    phase: a.phase,
    open: a.open,
    completedAt: date(a.completedAt),
    score: a.score,
    levelOrders: (a.levelOrders || []).map((ids) => [...ids]),
    questions: (a.questions || []).map((x) => ({
      questionId: x.questionId,
      wrongAttempts: x.wrongAttempts,
      hintUsed: x.hintUsed,
      correctAt: date(x.correctAt),
    })),
  });
}
// Recompute the journey score from the stored question bookkeeping against the
// frozen course version. Merely having Progress.source=assessment, a
// bestAttemptId or a high summary score is not evidence.
export function verifyCompletedAttempt(a, employeeId) {
  try {
    if (
      !a ||
      !same(a.employeeId, employeeId) ||
      a.phase !== "completed" ||
      a.open !== false ||
      !validDate(a.completedAt)
    )
      return null;
    if (!MODULE_KEYS.includes(a.moduleKey)) return null;
    const c = COURSES[a.moduleKey];
    if (!c || a.version !== (c.version || COURSE_VERSION)) return null;
    // Every level order must be an exact permutation of that level's questions.
    if (!Array.isArray(a.levelOrders) || a.levelOrders.length !== c.levels.length)
      return null;
    for (let i = 0; i < c.levels.length; i++) {
      const expected = c.levels[i].questions.map((q) => q.id);
      if (!uniqueExact(a.levelOrders[i], expected)) return null;
    }
    // Exactly one question entry per course question, each finally answered
    // correctly, with a valid completion timestamp.
    const allQuestions = c.levels.flatMap((l) => l.questions);
    if (
      !Array.isArray(a.questions) ||
      !uniqueExact(
        (a.questions || []).map((x) => x.questionId),
        allQuestions.map((q) => q.id),
      )
    )
      return null;
    let total = 0;
    for (const entry of a.questions) {
      const q = allQuestions.find((x) => x.id === entry.questionId);
      if (
        typeof entry.wrongAttempts !== "number" ||
        entry.wrongAttempts < 0 ||
        !Number.isInteger(entry.wrongAttempts) ||
        !validDate(entry.correctAt)
      )
        return null;
      if (entry.lastOptionId !== null && entry.correctAt && !q.options.some((o) => o.id === entry.lastOptionId))
        return null;
      total += questionScore(entry.wrongAttempts);
    }
    const score = Math.round((total / allQuestions.length) * 10) / 10;
    if (a.score !== score) return null;
    return {
      key: a.moduleKey,
      title: c.title,
      version: a.version,
      attemptId: String(a._id),
      score,
      activityScore: null,
      quizScore: null,
      assessedAt: new Date(a.completedAt),
      evidenceDigest: evidenceDigest(a),
    };
  } catch {
    return null;
  }
}
function snapshotPayload(record) {
  return {
    employeeId: String(record.employeeId),
    programVersion: record.programVersion,
    programTitle: record.programTitle,
    certificateId: record.certificateId,
    employeeName: record.employeeName,
    employeeIdentifier: record.employeeIdentifier,
    identifierLabel: record.identifierLabel,
    demoLearner: Boolean(record.demoLearner),
    timeZone: record.timeZone,
    issuedAt: date(record.issuedAt),
    completedAt: date(record.completedAt),
    overallScore: record.overallScore,
    issuedBy: String(record.issuedBy),
    issuedByRole: record.issuedByRole,
    modules: record.modules.map((m) => ({
      key: m.key,
      title: m.title,
      version: m.version,
      attemptId: String(m.attemptId),
      score: m.score,
      activityScore: m.activityScore,
      quizScore: m.quizScore,
      assessedAt: date(m.assessedAt),
      firstPassedAt: date(m.firstPassedAt),
      evidenceDigest: m.evidenceDigest,
    })),
  };
}
export function verifyIssuedRecord(record, attempts, employeeId) {
  try {
    if (
      !record ||
      !same(record.employeeId, employeeId) ||
      record.snapshotDigest !== digest(snapshotPayload(record))
    )
      return false;
    if (
      !uniqueExact(
        record.modules.map((m) => m.key),
        MODULE_KEYS,
      ) ||
      !validDate(record.issuedAt)
    )
      return false;
    for (const m of record.modules) {
      const a = attempts.find((a) => same(a._id, m.attemptId));
      if (
        !a ||
        !same(a.employeeId, employeeId) ||
        a.moduleKey !== m.key ||
        a.version !== m.version ||
        a.phase !== "completed" ||
        a.open !== false ||
        a.score < 70
      )
        return false;
      if (
        evidenceDigest(a) !== m.evidenceDigest ||
        m.score !== a.score ||
        (m.activityScore ?? null) !== (a.activityScore ?? null) ||
        (m.quizScore ?? null) !== (a.quizScore ?? null)
      )
        return false;
    }
    return (
      record.overallScore ===
      Math.round((record.modules.reduce((n, m) => n + m.score, 0) / 3) * 10) /
        10
    );
  } catch {
    return false;
  }
}
function publicCertificate(record, valid) {
  if (!record) return null;
  const formatted = (value) => {
    try {
      return validDate(value)
        ? certificateDate(value, record.timeZone)
        : "Unavailable";
    } catch {
      return "Unavailable";
    }
  };
  return {
    certificateId: record.certificateId,
    programTitle: record.programTitle,
    programVersion: record.programVersion,
    employeeName: record.employeeName,
    employeeIdentifier: record.employeeIdentifier,
    identifierLabel: record.identifierLabel,
    demoLearner: record.demoLearner,
    issuedAt: record.issuedAt,
    completedAt: record.completedAt,
    timeZone: record.timeZone,
    issueDate: formatted(record.issuedAt),
    completionDate: formatted(record.completedAt),
    overallScore: record.overallScore,
    valid,
    modules: (record.modules || []).map((m) => ({
      key: m.key,
      title: m.title,
      score: m.score,
      activityScore: m.activityScore,
      quizScore: m.quizScore,
      assessedAt: m.assessedAt,
    })),
  };
}
export async function completionStatus(employee, supplied = {}) {
  const [attempts, progress, record] = await Promise.all([
    supplied.attempts ??
      TrainingAttempt.find({
        employeeId: employee._id,
        moduleKey: { $in: MODULE_KEYS },
      }).lean(),
    supplied.progress ?? Progress.find({ employeeId: employee._id }).lean(),
    supplied.record !== undefined
      ? supplied.record
      : Certificate.findOne({
          employeeId: employee._id,
          programVersion: PROGRAM_VERSION,
        }).lean(),
  ]);
  const verified = attempts
    .map((a) => verifyCompletedAttempt(a, employee._id))
    .filter(Boolean);
  const modules = MODULE_KEYS.map((key) => {
    const candidates = verified
      .filter((a) => a.key === key)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.assessedAt - b.assessedAt ||
          a.attemptId.localeCompare(b.attemptId),
      );
    const best = candidates[0];
    const passed = candidates
      .filter((a) => a.score >= 70)
      .sort((a, b) => a.assessedAt - b.assessedAt)[0];
    const raw = progress.find((p) => p.moduleKey === key);
    const active = attempts.find((a) => a.moduleKey === key && a.open);
    const invalid = attempts.some(
      (a) =>
        a.moduleKey === key &&
        a.phase === "completed" &&
        !verified.some((v) => v.attemptId === String(a._id)),
    );
    return {
      key,
      title: COURSES[key].title,
      attempts: candidates.length,
      score: best?.score ?? null,
      activityScore: best?.activityScore ?? null,
      quizScore: best?.quizScore ?? null,
      attemptId: best?.attemptId || null,
      assessedAt: best?.assessedAt || null,
      firstPassedAt: passed?.assessedAt || null,
      verified: Boolean(best),
      passed: Boolean(best && best.score >= 70),
      classification: !best
        ? "Not verified"
        : best.score >= 85
          ? "Excellent"
          : best.score >= 70
            ? "Pass"
            : "Retake",
      reason: best
        ? best.score >= 70
          ? "Verified pass"
          : "Retake required — below 70"
        : active
          ? "Assessment in progress"
          : invalid
            ? "Assessment record needs review"
            : raw?.source === "demo"
              ? "Sample score — assessment required"
              : raw
                ? "Summary score is not verified evidence"
                : "Not yet assessed",
      activeAttemptId: active ? String(active._id) : null,
    };
  });
  const passed = modules.filter((m) => m.passed).length;
  const eligible = passed === 3;
  const overallScore = modules.every((m) => m.verified)
    ? Math.round((modules.reduce((n, m) => n + m.score, 0) / 3) * 10) / 10
    : null;
  const valid = record
    ? verifyIssuedRecord(record, attempts, employee._id)
    : false;
  const canIssue =
    eligible &&
    employee.status === "active" &&
    !employee.mustChangePassword &&
    !record;
  const reviewKey = digest({
    employeeId: String(employee._id),
    name: cleanText(`${employee.firstName} ${employee.lastName}`),
    identifier: cleanText(employee.employeeNumber || employee.username),
    modules: modules.map((m) => ({
      key: m.key,
      attemptId: m.attemptId,
      score: m.score,
      firstPassedAt: date(m.firstPassedAt),
    })),
  });
  const completedAt = eligible
    ? new Date(
        Math.max(...modules.map((m) => new Date(m.firstPassedAt).getTime())),
      )
    : null;
  return {
    employeeId: String(employee._id),
    demoLearner: Boolean(employee.isDemo),
    reviewKey,
    timeZone,
    completedAt,
    completionDate: completedAt ? certificateDate(completedAt, timeZone) : null,
    programTitle: PROGRAM_TITLE,
    programVersion: PROGRAM_VERSION,
    employeeName: cleanText(`${employee.firstName} ${employee.lastName}`),
    employeeIdentifier: cleanText(employee.employeeNumber || employee.username),
    identifierLabel: employee.employeeNumber ? "Employee ID" : "Account",
    modules,
    passed,
    total: 3,
    percent: Math.round((passed / 3) * 100),
    eligible,
    overallScore,
    canIssue,
    accountReady: employee.status === "active" && !employee.mustChangePassword,
    status: record
      ? valid
        ? "issued"
        : "review"
      : eligible
        ? "ready"
        : "locked",
    certificate: publicCertificate(record, valid),
    snapshotDiffers: Boolean(
      record &&
      (record.employeeName !==
        cleanText(`${employee.firstName} ${employee.lastName}`) ||
        record.employeeIdentifier !==
          cleanText(employee.employeeNumber || employee.username) ||
        modules.some(
          (m) => record.modules.find((s) => s.key === m.key)?.score !== m.score,
        )),
    ),
  };
}
export async function issueCertificate(employeeId, actor, reviewKey) {
  const employee = await User.findOne({ _id: employeeId, role: "employee" });
  if (!employee) fail(404, "Employee not found.");
  if (employee.status !== "active" || employee.mustChangePassword)
    fail(
      409,
      "The employee must have an active account and completed password setup before a certificate can be issued.",
      "CERTIFICATE_ACCOUNT_NOT_READY",
    );
  const status = await completionStatus(employee);
  if (status.certificate) {
    if (!status.certificate.valid)
      fail(
        409,
        "The issued record needs administrator review. No replacement has been generated.",
        "CERTIFICATE_REVIEW_REQUIRED",
      );
    return { created: false, completion: status };
  }
  if (!status.eligible)
    fail(
      409,
      "Pass all three genuine assessments at 70/100 or higher before generating a certificate. Sample and unverified summary scores do not count.",
      "CERTIFICATE_LOCKED",
    );
  if (reviewKey !== status.reviewKey)
    fail(
      409,
      "The name or assessment summary changed. Refresh and review it before generating the certificate.",
      "CERTIFICATE_REVIEW_STALE",
    );
  assertCertificateText(status.employeeName, status.employeeIdentifier);
  const proofs = await TrainingAttempt.find({
    _id: { $in: status.modules.map((m) => m.attemptId) },
    employeeId,
  }).lean();
  const modules = status.modules.map((m) => {
    const proof = proofs.find((a) => same(a._id, m.attemptId));
    const verified = verifyCompletedAttempt(proof, employeeId);
    if (!verified || verified.score < 70 || verified.score !== m.score)
      fail(
        409,
        "Assessment evidence changed. Refresh the completion summary before issuing.",
        "CERTIFICATE_EVIDENCE_CHANGED",
      );
    return { ...verified, firstPassedAt: m.firstPassedAt };
  });
  for (let n = 0; n < 3; n++) {
    const issuedAt = new Date();
    const year = new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone,
    }).format(issuedAt);
    const token = randomBytes(10)
      .toString("hex")
      .toUpperCase()
      .match(/.{1,4}/g)
      .join("-");
    const snapshot = {
      employeeId,
      programVersion: PROGRAM_VERSION,
      programTitle: PROGRAM_TITLE,
      certificateId: `ZI-${year}-${token}`,
      employeeName: status.employeeName,
      employeeIdentifier: status.employeeIdentifier,
      identifierLabel: status.identifierLabel,
      demoLearner: Boolean(employee.isDemo),
      modules,
      overallScore: status.overallScore,
      completedAt: new Date(
        Math.max(...modules.map((m) => new Date(m.firstPassedAt).getTime())),
      ),
      issuedAt,
      timeZone,
      issuedBy: actor._id,
      issuedByRole: actor.role,
    };
    snapshot.snapshotDigest = digest(snapshotPayload(snapshot));
    try {
      await Certificate.create(snapshot);
      // Reconcile an employee deletion that raced issuance on standalone MongoDB.
      if (!(await User.exists({ _id: employeeId, role: "employee" }))) {
        await Certificate.deleteMany({ employeeId });
        fail(404, "Employee no longer exists.");
      }
      await Audit.create({
        actorId: actor._id,
        actorName: cleanText(`${actor.firstName} ${actor.lastName}`),
        action: "issued a completion certificate",
        subject: `${snapshot.employeeName} · ${snapshot.certificateId}`,
      });
      return { created: true, completion: await completionStatus(employee) };
    } catch (e) {
      if (e.code !== 11000) throw e;
      const existing = await Certificate.findOne({
        employeeId,
        programVersion: PROGRAM_VERSION,
      }).lean();
      if (existing)
        return { created: false, completion: await completionStatus(employee) };
    }
  }
  fail(503, "A certificate reference could not be reserved. Please try again.");
}
export async function downloadableCertificate(employeeId) {
  const employee = await User.findOne({
    _id: employeeId,
    role: "employee",
  }).lean();
  if (!employee) fail(404, "Employee not found.");
  const record = await Certificate.findOne({
    employeeId,
    programVersion: PROGRAM_VERSION,
  }).lean();
  if (!record)
    fail(
      409,
      "Generate the certificate from the verified completion page first.",
      "CERTIFICATE_NOT_ISSUED",
    );
  const proofs = await TrainingAttempt.find({
    _id: { $in: record.modules.map((m) => m.attemptId) },
  }).lean();
  if (!verifyIssuedRecord(record, proofs, employeeId))
    fail(
      409,
      "This certificate’s evidence needs administrator review. The PDF is unavailable until the record is checked.",
      "CERTIFICATE_REVIEW_REQUIRED",
    );
  return record;
}
export async function administrativeCompletions() {
  const users = await User.find({ role: "employee" })
    .sort({ firstName: 1, lastName: 1 })
    .lean();
  const ids = users.map((u) => u._id);
  const [attempts, progress, records] = await Promise.all([
    TrainingAttempt.find({ employeeId: { $in: ids } }).lean(),
    Progress.find({ employeeId: { $in: ids } }).lean(),
    Certificate.find({
      employeeId: { $in: ids },
      programVersion: PROGRAM_VERSION,
    }).lean(),
  ]);
  return Promise.all(
    users.map(async (employee) => ({
      employee: {
        id: String(employee._id),
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeNumber: employee.employeeNumber,
        username: employee.username,
        status: employee.status,
      },
      completion: await completionStatus(employee, {
        attempts: attempts.filter((a) => same(a.employeeId, employee._id)),
        progress: progress.filter((p) => same(p.employeeId, employee._id)),
        record: records.find((c) => same(c.employeeId, employee._id)) || null,
      }),
    })),
  );
}
