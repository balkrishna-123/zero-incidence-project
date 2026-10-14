import mongoose from "mongoose";
import { MODULE_KEYS } from "./config.js";
const { Schema, model } = mongoose;
// Module journey attempt: Introduction → Level study → Level quiz (×3) → Final.
// Each question is worth 100; every wrong attempt before the correct answer
// costs 25 (minimum 0) — a 20-second timeout counts as a wrong attempt and
// the window restarts. The module score is the average of the twenty-four
// question scores. A level is passed when all of its questions are answered
// correctly.
const questionEntry = new Schema(
  {
    questionId: { type: String, required: true },
    wrongAttempts: { type: Number, min: 0, default: 0 },
    timeouts: { type: Number, min: 0, default: 0 },
    hintUsed: { type: Boolean, default: false },
    lastOptionId: { type: String, default: null },
    correctAt: Date,
  },
  { _id: false },
);
const attemptSchema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    moduleKey: { type: String, enum: MODULE_KEYS, required: true },
    version: { type: String, required: true },
    phase: {
      type: String,
      enum: ["intro", "study", "quiz", "completed"],
      default: "intro",
    },
    open: { type: Boolean, default: true },
    levelIndex: { type: Number, min: 0, default: 0 },
    // When the current question's 20-second window opened; null outside a
    // level quiz. Drives the server-side time limit.
    currentOpenedAt: { type: Date, default: null },
    // Shuffled question order inside each level.
    levelOrders: { type: [[String]], required: true },
    optionOrders: { type: Map, of: [String] },
    // One entry per question, in the order questions were first reached.
    // Immutable per-question bookkeeping drives the average score.
    questions: { type: [questionEntry], default: [] },
    score: { type: Number, min: 0, max: 100 },
    completedAt: Date,
    recordedAt: Date,
  },
  { timestamps: true, optimisticConcurrency: true },
);
attemptSchema.index(
  { employeeId: 1, moduleKey: 1, open: 1 },
  { unique: true, partialFilterExpression: { open: true } },
);
export const TrainingAttempt = model("TrainingAttempt", attemptSchema);
