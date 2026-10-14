import mongoose from "mongoose";
import { MODULE_KEYS } from "./config.js";
const { Schema, model } = mongoose;
const userSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    age: { type: Number, min: 16, max: 100 },
    employeeNumber: { type: String, unique: true, sparse: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "employee", "trainer"], required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    mustChangePassword: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
    passwordChangedAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const User = model("User", userSchema);
export const Trainer = model(
  "Trainer",
  new Schema(
    {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      nickname: { type: String, required: true },
      nicknameKey: { type: String, unique: true, required: true },
      age: { type: Number, min: 16, max: 100 },
      imageUrl: { type: String, default: "" },
      introduction: { type: String, maxlength: 600 },
      status: { type: String, enum: ["active", "inactive"], default: "active" },
      // Optional linked sign-in account. When present the trainer can log in
      // with the ID and password the administrator provides.
      userId: { type: Schema.Types.ObjectId, ref: "User", unique: true, sparse: true },
      // Role-based permissions assigned by the administrator.
      permissions: {
        viewProgress: { type: Boolean, default: false },
        resetPassword: { type: Boolean, default: false },
        _id: false,
      },
    },
    { timestamps: true },
  ),
);
// Promotion applications: employee -> trainer (90+ in every module) and
// trainer -> administrator (tenure plus certified employees under their
// guidance — see PROMOTION in config.js and server/progress-percent.js).
// Decided by the administrator.
export const Application = model(
  "Application",
  new Schema(
    {
      applicantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      type: { type: String, enum: ["trainer", "admin"], required: true },
      message: { type: String, maxlength: 600, default: "" },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
      decidedAt: Date,
    },
    { timestamps: true },
  ),
);
// Employees can report a trainer to the administrator (e.g. a guide that is
// not helping effectively). The administrator reviews and resolves reports.
const trainerReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    trainerId: { type: Schema.Types.ObjectId, ref: "Trainer", required: true },
    moduleKey: { type: String, enum: MODULE_KEYS, default: null },
    message: { type: String, required: true, trim: true, maxlength: 600 },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
  },
  { timestamps: true },
);
trainerReportSchema.index({ status: 1, createdAt: -1 });
export const TrainerReport = model("TrainerReport", trainerReportSchema);
export const Module = model(
  "Module",
  new Schema({
    key: { type: String, enum: MODULE_KEYS, unique: true, required: true },
    title: String,
    description: String,
    objectives: [String],
    rules: [String],
    trainerId: { type: Schema.Types.ObjectId, ref: "Trainer", default: null },
  }),
);
const progressSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    moduleKey: { type: String, enum: MODULE_KEYS, required: true },
    score: { type: Number, min: 0, max: 100, required: true },
    attempts: { type: Number, min: 1, default: 1 },
    assessedAt: Date,
    bestAttemptId: { type: Schema.Types.ObjectId, ref: "TrainingAttempt" },
    activityScore: { type: Number, min: 0, max: 70 },
    quizScore: { type: Number, min: 0, max: 30 },
    lastScore: { type: Number, min: 0, max: 100 },
    lastAssessedAt: Date,
    source: {
      type: String,
      enum: ["demo", "assessment"],
      default: "assessment",
    },
  },
  { timestamps: true },
);
progressSchema.index({ employeeId: 1, moduleKey: 1 }, { unique: true });
export const Progress = model("Progress", progressSchema);
export const Counter = model(
  "Counter",
  new Schema({ _id: String, value: { type: Number, default: 1000 } }),
);
export const Audit = model(
  "Audit",
  new Schema({
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    action: String,
    subject: String,
    createdAt: { type: Date, default: Date.now, index: true },
  }),
);
export function safeUser(u) {
  if (!u) return null;
  return {
    id: String(u._id),
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    role: u.role,
    age: u.age,
    employeeNumber: u.employeeNumber,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    isDemo: u.isDemo,
  };
}
export function progressSummary(rows = []) {
  const modules = MODULE_KEYS.map((key) => {
    const p = rows.find((row) => row.moduleKey === key);
    const score = p?.score ?? null;
    return {
      key,
      score,
      attempts: p?.attempts || 0,
      assessedAt: p?.assessedAt || null,
      source: p?.source || null,
      bestAttemptId: p?.bestAttemptId ? String(p.bestAttemptId) : null,
      activityScore: p?.activityScore ?? null,
      quizScore: p?.quizScore ?? null,
      lastScore: p?.lastScore ?? null,
      status:
        score === null ? "not-started" : score >= 70 ? "passed" : "retake",
      classification:
        score === null
          ? "Not started"
          : score >= 85
            ? "Excellent"
            : score >= 70
              ? "Pass"
              : "Retake",
    };
  });
  const passed = modules.filter((m) => m.status === "passed").length;
  const assessed = modules.filter((m) => m.score !== null).length;
  return {
    modules,
    passed,
    assessed,
    total: 3,
    percent: Math.round((passed / 3) * 100),
    overallScore:
      assessed === 3
        ? Math.round((modules.reduce((s, m) => s + m.score, 0) / 3) * 10) / 10
        : null,
    eligible: passed === 3,
    status:
      passed === 3
        ? "complete"
        : modules.some((m) => m.status === "retake")
          ? "retake"
          : assessed
            ? "in-progress"
            : "not-started",
    hasDemoScores: rows.some((r) => r.source === "demo"),
  };
}
export async function nextEmployeeNumber() {
  // One atomic counter prevents collisions when multiple admins create accounts.
  const counter = await Counter.findOneAndUpdate(
    { _id: "employee-number" },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: false },
  );
  return `ZI-${new Date().getFullYear()}-${String(counter.value).padStart(4, "0")}`;
}
