import mongoose from "mongoose";
const { Schema, model } = mongoose;
const moduleSnapshot = new Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    version: { type: String, required: true },
    attemptId: { type: Schema.Types.ObjectId, required: true },
    score: { type: Number, min: 70, max: 100, required: true },
    activityScore: Number,
    quizScore: Number,
    assessedAt: { type: Date, required: true },
    firstPassedAt: { type: Date, required: true },
    evidenceDigest: { type: String, required: true },
  },
  { _id: false },
);
const certificateSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    immutable: true,
  },
  programVersion: { type: String, required: true, immutable: true },
  programTitle: { type: String, required: true, immutable: true },
  certificateId: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
  },
  employeeName: { type: String, required: true, immutable: true },
  employeeIdentifier: { type: String, required: true, immutable: true },
  identifierLabel: { type: String, required: true, immutable: true },
  demoLearner: { type: Boolean, default: false, immutable: true },
  modules: { type: [moduleSnapshot], required: true, immutable: true },
  overallScore: {
    type: Number,
    min: 70,
    max: 100,
    required: true,
    immutable: true,
  },
  completedAt: { type: Date, required: true, immutable: true },
  issuedAt: { type: Date, required: true, default: Date.now, immutable: true },
  timeZone: { type: String, required: true, immutable: true },
  issuedBy: { type: Schema.Types.ObjectId, ref: "User", immutable: true },
  issuedByRole: { type: String, enum: ["admin", "employee"], immutable: true },
  snapshotDigest: { type: String, required: true, immutable: true },
});
certificateSchema.index({ employeeId: 1, programVersion: 1 }, { unique: true });
export const Certificate = model("Certificate", certificateSchema);
