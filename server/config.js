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
export const DEMO_CREDENTIALS = {
  admin: { username: "safety.admin", password: "ZeroIncident!2026" },
  employee: { username: "ramesh.s", password: "Welcome!2026" },
  trainer: { username: "yeti", password: "Welcome!2026" },
};
