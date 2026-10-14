import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const production = process.env.NODE_ENV === "production";
export const demoMode = process.env.DEMO_MODE === "true";
if (production && demoMode)
  throw new Error("DEMO_MODE must be false in production.");
if (
  production &&
  (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32 ||
    process.env.SESSION_SECRET.startsWith("replace"))
) {
  throw new Error(
    "Set a strong, random SESSION_SECRET of at least 32 characters.",
  );
}
export const sessionSecret =
  process.env.SESSION_SECRET || crypto.randomBytes(48).toString("hex");
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "trainer-images");
export const MODULE_KEYS = [
  "manual-handling",
  "working-at-height",
  "hazard-perception",
];
// Promotion rules (client requirement, Oct 2026 revision).
// Employee -> trainer: 90/100 or higher in every module, administrator approves.
// Trainer -> administrator: tenure plus a training track record instead of the
// retired star-rating system. Both numbers are configurable through the
// environment so the client can tune them without a code change.
export const PROMOTION = {
  trainerMinScorePerModule: 90,
  adminMinDaysActive: Number(process.env.PROMOTION_ADMIN_MIN_DAYS || 90),
  adminMinCertifiedEmployees: Number(
    process.env.PROMOTION_ADMIN_MIN_CERTIFIED || 5,
  ),
};
export const DEMO_CREDENTIALS = {
  admin: { username: "safety.admin", password: "ZeroIncident!2026" },
  employee: { username: "ramesh.s", password: "Welcome!2026" },
  trainer: { username: "yeti", password: "Welcome!2026" },
};
