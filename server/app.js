import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import multer from "multer";
import sharp from "sharp";
import crypto from "node:crypto";
import path from "node:path";
import { readFileSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { z } from "zod";
import {
  ROOT,
  UPLOAD_DIR,
  production,
  demoMode,
  sessionSecret,
  MODULE_KEYS,
  DEMO_CREDENTIALS,
  PROMOTION,
} from "./config.js";

const APP_VERSION = JSON.parse(
  readFileSync(path.join(ROOT, "package.json"), "utf8"),
).version;
import {
  User,
  Trainer,
  Module,
  Progress,
  Audit,
  Application,
  TrainerReport,
  safeUser,
  progressSummary,
  nextEmployeeNumber,
} from "./models.js";
import {
  modulePercentMap,
  modulePercentMaps,
  overallPercent,
  trainerAdminEligibility,
} from "./progress-percent.js";
import { hashPassword, verifyPassword, passwordProblem } from "./passwords.js";

import { AVAILABLE_MODULE_KEYS } from "./training-content.js";
import { Certificate } from "./certificate-model.js";
import {
  completionStatus,
  issueCertificate,
  downloadableCertificate,
  administrativeCompletions,
} from "./completion.js";
import { renderCertificatePDF } from "./certificate-pdf.js";
import { TrainingAttempt } from "./training-models.js";
import { createTrainingRouter, activeTraining } from "./training.js";

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, message, code) => {
  throw new HttpError(status, message, code);
};
const name = z.string().trim().min(1, "This field is required.").max(60);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,39}$/,
    "Use 3–40 letters, numbers, dots, hyphens or underscores.",
  );
const age = z.coerce
  .number()
  .int()
  .min(16, "Employees must be at least 16.")
  .max(100);
const password = z
  .string()
  .max(128)
  .superRefine((value, ctx) => {
    const message = passwordProblem(value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });
const employeeInput = z.object({
  firstName: name,
  lastName: name,
  age,
  username,
  employeeNumber: z
    .string()
    .trim()
    .max(30)
    .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers and hyphens.")
    .optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});
const employeeCreate = employeeInput
  .extend({ temporaryPassword: password, confirmPassword: z.string() })
  .refine((d) => d.temporaryPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
const newPasswordInput = z
  .object({ newPassword: password, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
const permissionsInput = z.object({
  viewProgress: z.boolean().default(false),
  resetPassword: z.boolean().default(false),
});
const trainerInput = z.object({
  firstName: name,
  lastName: name,
  nickname: name.max(30),
  age: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    age.optional(),
  ),
  introduction: z.string().trim().max(600).default(""),
  status: z.enum(["active", "inactive"]).default("active"),
  moduleKeys: z.array(z.enum(MODULE_KEYS)).max(3).default([]),
  permissions: permissionsInput,
});
// New trainers sign in with the ID and password the administrator provides.
const trainerCreate = trainerInput.extend({
  username,
  temporaryPassword: password,
  confirmPassword: z.string(),
});
const applicationMessage = z
  .string()
  .trim()
  .max(600)
  .default("");
const validId = (id) => {
  if (!mongoose.isValidObjectId(id)) fail(404, "Record not found.");
  return id;
};
const escapedRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const audit = (req, action, subject) =>
  Audit.create({
    actorId: req.user._id,
    actorName: `${req.user.firstName} ${req.user.lastName}`,
    action,
    subject,
  });
const token = () => crypto.randomBytes(32).toString("hex");
const regenerate = (req) =>
  new Promise((resolve, reject) =>
    req.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
function configureCookie(req) {
  // The hosted development preview is a cross-site iframe. Partition its secure
  // cookie so authentication also works when unpartitioned third-party cookies
  // are blocked. Production remains unframed and SameSite=Lax.
  const embeddedPreview = !production && req.secure;
  req.session.cookie.sameSite = embeddedPreview ? "none" : "lax";
  req.session.cookie.partitioned = embeddedPreview;
}
const saveSession = (req) =>
  new Promise((resolve, reject) =>
    req.session.save((e) => (e ? reject(e) : resolve())),
  );
const destroySession = (req) =>
  new Promise((resolve, reject) =>
    req.session.destroy((e) => (e ? reject(e) : resolve())),
  );
function clearSessionCookie(req, res) {
  const embedded = !production && req.secure;
  res.clearCookie("zi.sid", {
    path: "/",
    httpOnly: true,
    secure: req.secure,
    sameSite: embedded ? "none" : "lax",
    partitioned: embedded,
  });
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 12 },
});

async function requireAuth(req, res, next) {
  if (!req.session.userId)
    return next(
      new HttpError(401, "Please sign in to continue.", "AUTH_REQUIRED"),
    );
  try {
    const user = await User.findById(req.session.userId);
    if (
      !user ||
      user.status !== "active" ||
      user.sessionVersion !== req.session.userVersion ||
      Date.now() > req.session.authExpiresAt
    ) {
      await destroySession(req);
      clearSessionCookie(req, res);
      return next(
        new HttpError(
          401,
          "Your session has ended. Please sign in again.",
          "SESSION_ENDED",
        ),
      );
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
function requireReady(req, res, next) {
  if (req.user.mustChangePassword)
    return next(
      new HttpError(
        403,
        "Change your temporary password before continuing.",
        "PASSWORD_CHANGE_REQUIRED",
      ),
    );
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin")
    return next(
      new HttpError(403, "Administrator access is required.", "FORBIDDEN"),
    );
  next();
}
// Learners are employees plus employees promoted to trainers: both keep
// training progress that administrators and trainers can see.
async function employeeById(id) {
  const employee = await User.findOne({
    _id: validId(id),
    role: { $in: ["employee", "trainer"] },
  });
  if (!employee) fail(404, "Employee not found.");
  return employee;
}
async function trainerById(id) {
  const trainer = await Trainer.findById(validId(id));
  if (!trainer) fail(404, "Trainer not found.");
  return trainer;
}
async function saveImage(file) {
  if (!file) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
    fail(422, "Upload a JPG, PNG or WebP image.");
  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 20_000_000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages || 1) > 1
    )
      fail(422, "Use a still JPG, PNG or WebP image.");
    const filename = `${crypto.randomUUID()}.webp`;
    await image
      .rotate()
      .resize(512, 512, {
        fit: "cover",
        position: "attention",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toFile(path.join(UPLOAD_DIR, filename));
    return `/media/trainers/${filename}`;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail(
      422,
      "That image could not be read. Use a valid JPG, PNG or WebP up to 5 MB and 20 megapixels.",
    );
  }
}
async function removeImage(url) {
  if (url?.startsWith("/media/trainers/"))
    await unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
}
function parseTrainer(body) {
  let keys;
  try {
    keys = JSON.parse(body.moduleKeys || "[]");
  } catch {
    fail(422, "Invalid module selection.");
  }
  let permissions = body.permissions;
  if (typeof permissions === "string" && permissions.trim()) {
    try {
      permissions = JSON.parse(permissions);
    } catch {
      fail(422, "Invalid permission selection.");
    }
  }
  return trainerInput.parse({
    ...body,
    moduleKeys: keys,
    ...(permissions ? { permissions } : {}),
  });
}
async function assignModules(trainerId, keys) {
  await Module.updateMany(
    { trainerId, key: { $nin: keys } },
    { $set: { trainerId: null } },
  );
  await Module.updateMany({ key: { $in: keys } }, { $set: { trainerId } });
}
async function trainerView(trainer) {
  const [modules, account, eligibility] = await Promise.all([
    Module.find({ trainerId: trainer._id }).select("key title").lean(),
    trainer.userId ? User.findById(trainer.userId).lean() : null,
    trainerAdminEligibility(trainer),
  ]);
  const doc = trainer.toObject({ versionKey: false });
  delete doc.permissions?._id;
  return {
    ...doc,
    id: String(trainer._id),
    moduleKeys: modules.map((m) => m.key),
    modules,
    // Linked sign-in account (ID provided by the administrator).
    accountUsername: account?.username || null,
    hasAccount: !!trainer.userId,
    accountMustChangePassword: account?.mustChangePassword ?? null,
    // Tenure + certified-employee track record (administrator promotion).
    eligibility,
  };
}
// Attach per-module completion percentages (and the overall figure) to a
// list of employee documents for the trainer/administrator rosters.
async function withPercents(employees, progressRows) {
  const percents = await modulePercentMaps(employees.map((e) => e._id));
  return employees.map((e) => {
    const map = percents.get(String(e._id)) || {};
    return {
      ...safeUser(e),
      progress: progressSummary(
        progressRows.filter((p) => String(p.employeeId) === String(e._id)),
      ),
      modulePercents: map,
      overallPercent: overallPercent(map),
    };
  });
}
async function moduleViews() {
  const modules = await Module.find().populate("trainerId").lean();
  return MODULE_KEYS.map((key) => {
    const m = modules.find((m) => m.key === key);
    const trainer = m?.trainerId?.status === "active" ? m.trainerId : null;
    return {
      key,
      title: m?.title,
      description: m?.description,
      objectives: m?.objectives || [],
      rules: m?.rules || [],
      trainer: trainer
        ? {
            id: String(trainer._id),
            nickname: trainer.nickname,
            imageUrl: trainer.imageUrl,
            introduction: trainer.introduction,
          }
        : null,
      assessmentAvailable: AVAILABLE_MODULE_KEYS.includes(key),
    };
  });
}

export async function createApp(mongoUrl) {
  await Promise.all([TrainingAttempt.init(), Certificate.init()]);
  await mkdir(UPLOAD_DIR, { recursive: true });
  const app = express();
  app.disable("x-powered-by");
  // Exactly one trusted reverse proxy. Keep this aligned with your production host.
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-eval'"], // A-Frame (forklift game) compiles shaders via new Function()
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: production ? ["'none'"] : null,
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      frameguard: production ? { action: "deny" } : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  const store = MongoStore.create({
    mongoUrl,
    collectionName: "sessions",
    ttl: 8 * 3600,
    autoRemove: "native",
  });
  app.locals.sessionStore = store;
  app.use(
    session({
      name: "zi.sid",
      secret: sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: "auto", sameSite: "lax", path: "/" },
    }),
  );
  app.use((req, res, next) => {
    configureCookie(req);
    next();
  });
  const api = express.Router();
  app.use("/api", api);
  api.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  api.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests. Please try again later." },
    }),
  );
  api.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const received = req.get("X-CSRF-Token");
    const expected = req.session.csrfToken;
    if (
      !received ||
      !expected ||
      Buffer.byteLength(received) !== Buffer.byteLength(expected) ||
      !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
    ) {
      return next(
        new HttpError(
          403,
          "Your security token expired. Refresh the page and try again.",
          "CSRF_INVALID",
        ),
      );
    }
    next();
  });
  api.get("/health", (req, res) =>
    res.json({
      status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
      phase: "complete-learning-and-certificate-flow",
    }),
  );
  api.get("/session", async (req, res) => {
    if (!req.session.csrfToken) req.session.csrfToken = token();
    let user = null;
    if (req.session.userId) {
      const record = await User.findById(req.session.userId);
      if (
        record &&
        record.status === "active" &&
        record.sessionVersion === req.session.userVersion &&
        Date.now() <= req.session.authExpiresAt
      ) {
        user = safeUser(record);
        if (record.role === "trainer") {
          const profile = await Trainer.findOne({ userId: record._id }).lean();
          user.trainerId = profile ? String(profile._id) : null;
        }
      } else {
        delete req.session.userId;
        delete req.session.userVersion;
        delete req.session.authExpiresAt;
      }
    }
    let demos;
    if (demoMode) {
      const [onboarding, adminAccount, trainerAccount] = await Promise.all([
        User.findOne({ username: DEMO_CREDENTIALS.employee.username }).select(
          "mustChangePassword sessionVersion status",
        ),
        User.findOne({
          username: DEMO_CREDENTIALS.admin.username,
          role: "admin",
        }).select("mustChangePassword sessionVersion status"),
        User.findOne({
          username: DEMO_CREDENTIALS.trainer.username,
          role: "trainer",
        }).select("mustChangePassword sessionVersion status"),
      ]);
      demos = {
        ...DEMO_CREDENTIALS,
        employeeAvailable:
          !!onboarding &&
          onboarding.status === "active" &&
          onboarding.mustChangePassword &&
          onboarding.sessionVersion === 0,
        adminAvailable:
          !!adminAccount &&
          adminAccount.status === "active" &&
          !adminAccount.mustChangePassword &&
          adminAccount.sessionVersion === 0,
        trainerAvailable:
          !!trainerAccount &&
          trainerAccount.status === "active" &&
          !trainerAccount.mustChangePassword &&
          trainerAccount.sessionVersion === 0,
      };
    }
    res.json({
      user,
      csrfToken: req.session.csrfToken,
      demoMode,
      appVersion: APP_VERSION,
      ...(demos ? { demoCredentials: demos } : {}),
      scope: "admin-authentication",
    });
  });
  const dummyHash = await hashPassword(crypto.randomBytes(24).toString("hex"));
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error:
        "Too many sign-in attempts. Please wait 15 minutes before trying again.",
    },
  });
  api.post("/auth/login", loginLimit, async (req, res) => {
    const input = z
      .object({
        username: z.string().trim().toLowerCase().max(80),
        password: z.string().min(1).max(128),
        remember: z.boolean().optional(),
      })
      .parse(req.body);
    const user = await User.findOne({ username: input.username }).select(
      "+passwordHash",
    );
    const correct = await verifyPassword(
      input.password,
      user?.passwordHash || dummyHash,
    );
    if (!correct || !user || user.status !== "active")
      fail(
        401,
        "Invalid username or password. If your account is inactive, contact your administrator.",
        "INVALID_CREDENTIALS",
      );
    await regenerate(req);
    configureCookie(req);
    req.session.userId = String(user._id);
    req.session.userVersion = user.sessionVersion;
    req.session.csrfToken = token();
    const lifetime = input.remember ? 14 * 86400000 : 8 * 3600000;
    req.session.authExpiresAt = Date.now() + lifetime;
    req.session.cookie.maxAge = input.remember ? lifetime : null;
    user.lastLoginAt = new Date();
    await user.save();
    await saveSession(req);
    res.json({ user: safeUser(user), csrfToken: req.session.csrfToken });
  });
  api.post("/auth/logout", async (req, res) => {
    await destroySession(req);
    clearSessionCookie(req, res);
    res.json({ message: "You have been signed out." });
  });
  const passwordLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 25,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error:
        "Too many password operations. Please wait 15 minutes and try again.",
    },
  });
  api.post(
    "/auth/first-password",
    requireAuth,
    passwordLimit,
    async (req, res) => {
      if (!req.user.mustChangePassword)
        fail(
          409,
          "Your initial password has already been changed. Use account settings instead.",
        );
      const input = newPasswordInput.parse(req.body);
      const user = await User.findById(req.user._id).select("+passwordHash");
      if (await verifyPassword(input.newPassword, user.passwordHash))
        fail(
          422,
          "Your new password must be different from your temporary password.",
        );
      // Compare-and-set prevents an older concurrent session from overwriting a reset.
      const updated = await User.updateOne(
        {
          _id: user._id,
          sessionVersion: req.session.userVersion,
          mustChangePassword: true,
        },
        {
          $set: {
            passwordHash: await hashPassword(input.newPassword),
            mustChangePassword: false,
            passwordChangedAt: new Date(),
          },
          $inc: { sessionVersion: 1 },
        },
      );
      if (!updated.modifiedCount)
        fail(409, "This account changed. Please sign in again.");
      await audit(req, "completed first-login password setup", user.username);
      await destroySession(req);
      clearSessionCookie(req, res);
      res.json({
        message: "Password updated. Sign in again with your new password.",
      });
    },
  );
  api.post(
    "/auth/change-password",
    requireAuth,
    requireReady,
    passwordLimit,
    async (req, res) => {
      const input = newPasswordInput.parse(req.body);
      const current = z
        .string()
        .min(1)
        .max(128)
        .parse(req.body.currentPassword);
      const user = await User.findById(req.user._id).select("+passwordHash");
      if (!(await verifyPassword(current, user.passwordHash)))
        fail(422, "Your current password is incorrect.");
      if (await verifyPassword(input.newPassword, user.passwordHash))
        fail(422, "Choose a password different from your current one.");
      const updated = await User.updateOne(
        { _id: user._id, sessionVersion: req.session.userVersion },
        {
          $set: {
            passwordHash: await hashPassword(input.newPassword),
            passwordChangedAt: new Date(),
          },
          $inc: { sessionVersion: 1 },
        },
      );
      if (!updated.modifiedCount)
        fail(409, "This account changed. Please sign in again.");
      await audit(req, "changed their password", user.username);
      await destroySession(req);
      clearSessionCookie(req, res);
      res.json({ message: "Password changed. Please sign in again." });
    },
  );
  api.get("/me/training", requireAuth, requireReady, async (req, res) => {
    if (req.user.role !== "employee")
      fail(403, "This endpoint is for employees.");
    const rows = await Progress.find({ employeeId: req.user._id }).lean();
    const [modules, application, eligibility, modulePercents] =
      await Promise.all([
        moduleViews(),
        Application.findOne({
          applicantId: req.user._id,
          type: "trainer",
        }).sort({ createdAt: -1 }).lean(),
        trainerEligibility(req.user._id),
        modulePercentMap(req.user._id),
      ]);
    res.json({
      modules,
      progress: progressSummary(rows),
      activeTraining: await activeTraining(req.user._id),
      completion: await completionStatus(req.user, { progress: rows }),
      // Per-module completion percentage (0-100) for the progress bars shown
      // at the top of every module and across the dashboards.
      modulePercents,
      trainerApplication: application
        ? { status: application.status, createdAt: application.createdAt }
        : null,
      trainerEligible: eligibility.eligible,
    });
  });

  // ---- Promotion rules (client requirements) ------------------------------
  // Employees may apply to become a trainer with 90/100 or higher in every
  // module. Trainers may apply to become an administrator once they combine
  // the configured tenure with the configured number of employees certified
  // under their guidance (see PROMOTION in server/config.js).
  async function trainerEligibility(userId) {
    const rows = await Progress.find({ employeeId: userId }).lean();
    const missing = MODULE_KEYS.filter(
      (key) =>
        (rows.find((r) => r.moduleKey === key)?.score ?? 0) <
        PROMOTION.trainerMinScorePerModule,
    );
    return { eligible: missing.length === 0, missing };
  }

  api.post(
    "/me/apply-trainer",
    requireAuth,
    requireReady,
    async (req, res) => {
      if (req.user.role !== "employee")
        fail(403, "Only employees can apply for a trainer position.");
      const message = applicationMessage.parse(req.body.message || "");
      const existing = await Application.findOne({
        applicantId: req.user._id,
        type: "trainer",
        status: "pending",
      });
      if (existing)
        fail(409, "Your application is already under review.");
      if (await Trainer.exists({ userId: req.user._id }))
        fail(409, "You already hold a trainer position.");
      const { eligible } = await trainerEligibility(req.user._id);
      if (!eligible)
        fail(
          409,
          "You need at least 90/100 in every module before applying.",
        );
      const application = await Application.create({
        applicantId: req.user._id,
        type: "trainer",
        message,
      });
      await audit(
        req,
        "applied for a trainer position",
        `${req.user.firstName} ${req.user.lastName}`,
      );
      res.status(201).json({ application: application.id });
    },
  );

  // ---- Trainer reports (employee feedback for the administrator) ----------
  // The star-rating feature was retired (Oct 2026 client revision). Employees
  // still reach the administrator through trainer reports, now opened from
  // Help & resources in the employee dashboard.
  const reportInput = z
    .object({
      trainerId: z.string().regex(/^[a-fA-F0-9]{24}$/),
      moduleKey: z.enum(MODULE_KEYS).nullable().optional(),
      message: z.string().trim().min(3, "Please add a short description.").max(600),
    })
    .strict();
  api.post("/me/trainer-reports", requireAuth, requireReady, async (req, res) => {
    const input = reportInput.parse(req.body);
    const trainer = await Trainer.findById(input.trainerId).lean();
    if (!trainer || trainer.status !== "active")
      fail(404, "That trainer does not exist or is inactive.");
    if (input.moduleKey) {
      const module = await Module.findOne({ key: input.moduleKey }).lean();
      if (!module?.trainerId || String(module.trainerId) !== input.trainerId)
        fail(409, "That trainer is not assigned to this module.");
    }
    const report = await TrainerReport.create({
      userId: req.user._id,
      trainerId: input.trainerId,
      moduleKey: input.moduleKey || null,
      message: input.message,
    });
    await audit(req, "reported a trainer to the administrator", trainer.nickname);
    res.status(201).json({ report: report.id });
  });
  api.get("/me/trainer-reports", requireAuth, requireReady, async (req, res) => {
    const rows = await TrainerReport.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("trainerId", "nickname")
      .lean();
    res.json({
      reports: rows.map((r) => ({
        id: String(r._id),
        trainer: r.trainerId?.nickname || "Trainer",
        moduleKey: r.moduleKey,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt || null,
      })),
    });
  });

  const employeeCertificateOnly = (req, res, next) => {
    if (req.user.role !== "employee")
      return next(
        Object.assign(new Error("This endpoint is for employees."), {
          status: 403,
        }),
      );
    next();
  };
  const certificateRequest = z
    .object({
      recipientId: z.string().regex(/^[a-fA-F0-9]{24}$/),
      reviewKey: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
  const sendCertificate = async (res, employeeId, expectedId) => {
    const record = await downloadableCertificate(employeeId);
    if (expectedId && expectedId !== record.certificateId)
      fail(
        409,
        "The certificate changed or the signed-in account is different. Refresh the completion page.",
        "CERTIFICATE_ID_CHANGED",
      );
    const pdf = await renderCertificatePDF(record);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Zero-Incident-${record.certificateId}.pdf"`,
      "Cache-Control": "no-store",
    });
    res.send(pdf);
  };
  api.get(
    "/me/certificate",
    requireAuth,
    requireReady,
    employeeCertificateOnly,
    async (req, res) => res.json(await completionStatus(req.user)),
  );
  api.post(
    "/me/certificate",
    requireAuth,
    requireReady,
    employeeCertificateOnly,
    async (req, res) => {
      const input = certificateRequest.parse(req.body);
      if (input.recipientId !== String(req.user._id))
        fail(403, "This certificate request is for a different account.");
      const result = await issueCertificate(
        req.user._id,
        req.user,
        input.reviewKey,
      );
      res.status(result.created ? 201 : 200).json(result.completion);
    },
  );
  api.get(
    "/me/certificate/pdf",
    requireAuth,
    requireReady,
    employeeCertificateOnly,
    async (req, res) =>
      sendCertificate(res, req.user._id, req.query.certificateId),
  );

  api.use("/training", requireAuth, requireReady, createTrainingRouter());

  const admin = express.Router();
  api.use("/admin", requireAuth, requireReady, requireAdmin, admin);
  admin.get("/certificates", async (req, res) =>
    res.json({ records: await administrativeCompletions() }),
  );
  admin.get("/employees/:id/certificate", async (req, res) =>
    res.json(await completionStatus(await employeeById(req.params.id))),
  );
  admin.post("/employees/:id/certificate", async (req, res) => {
    const employee = await employeeById(req.params.id);
    const input = certificateRequest.parse(req.body);
    if (input.recipientId !== String(employee._id))
      fail(
        409,
        "Review the matching employee before generating the certificate.",
      );
    const result = await issueCertificate(
      employee._id,
      req.user,
      input.reviewKey,
    );
    res.status(result.created ? 201 : 200).json(result.completion);
  });
  admin.get("/employees/:id/certificate/pdf", async (req, res) => {
    const employee = await employeeById(req.params.id);
    await sendCertificate(res, employee._id, req.query.certificateId);
  });
  admin.get("/overview", async (req, res) => {
    const [employees, progress, trainers, events] = await Promise.all([
      User.find({ role: "employee" }).sort({ createdAt: -1 }).lean(),
      Progress.find().lean(),
      Trainer.find().lean(),
      Audit.find().sort({ createdAt: -1 }).limit(7).lean(),
    ]);
    const complete = employees.filter(
      (e) =>
        progressSummary(
          progress.filter((p) => String(p.employeeId) === String(e._id)),
        ).eligible,
    ).length;
    res.json({
      stats: {
        total: employees.length,
        active: employees.filter((e) => e.status === "active").length,
        onboarding: employees.filter(
          (e) => e.mustChangePassword && e.status === "active",
        ).length,
        complete,
        trainers: trainers.length,
        activeTrainers: trainers.filter((t) => t.status === "active").length,
        pendingApplications: await Application.countDocuments({
          status: "pending",
        }),
        openTrainerReports: await TrainerReport.countDocuments({
          status: "open",
        }),
      },
      employees: withPercents(
        employees.slice(0, 5),
        progress,
      ),
      events,
      modules: await moduleViews(),
      demoMode,
    });
  });
  admin.get("/employees", async (req, res) => {
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 80);
    const status = ["active", "inactive"].includes(req.query.status)
      ? req.query.status
      : undefined;
    const page = Math.max(1, Math.min(100000, parseInt(req.query.page) || 1));
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const query = {
      role: { $in: ["employee", "trainer"] },
      ...(status ? { status } : {}),
    };
    if (search) {
      const pattern = new RegExp(escapedRegex(search), "i");
      query.$or = ["firstName", "lastName", "username", "employeeNumber"].map(
        (k) => ({ [k]: pattern }),
      );
    }
    if (req.query.onboarding === "true") query.mustChangePassword = true;
    const [employees, total, active, all] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
      User.countDocuments({
        role: { $in: ["employee", "trainer"] },
        status: "active",
      }),
      User.countDocuments({ role: { $in: ["employee", "trainer"] } }),
    ]);
    const progress = await Progress.find({
      employeeId: { $in: employees.map((e) => e._id) },
    }).lean();
    res.json({
      employees: await withPercents(employees, progress),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: { all, active, inactive: all - active },
    });
  });
  admin.post("/employees", async (req, res) => {
    const input = employeeCreate.parse(req.body);
    const employee = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      age: input.age,
      username: input.username,
      employeeNumber: input.employeeNumber || (await nextEmployeeNumber()),
      status: input.status,
      role: "employee",
      passwordHash: await hashPassword(input.temporaryPassword),
      mustChangePassword: true,
    });
    await audit(
      req,
      "registered an employee",
      `${employee.firstName} ${employee.lastName}`,
    );
    res.status(201).json({ employee: safeUser(employee) });
  });
  admin.get("/employees/:id", async (req, res) => {
    const employee = await employeeById(req.params.id);
    const rows = await Progress.find({ employeeId: employee._id }).lean();
    const withHash = await User.findById(employee._id).select("+passwordHash");
    const stored = withHash?.passwordHash || "";
    const parts = stored.split("$");
    const percentMap = await modulePercentMap(employee._id);
    res.json({
      employee: safeUser(employee),
      progress: progressSummary(rows),
      modulePercents: percentMap,
      overallPercent: overallPercent(percentMap),
      completion: await completionStatus(employee, { progress: rows }),
      passwordStorage: {
        format: "scrypt",
        parameters: "N=32768 · r=8 · p=3 (OWASP-recommended work factors)",
        saltHex: parts[4] || "",
        fullHash: stored,
        length: stored.length,
      },
    });
  });
  admin.patch("/employees/:id", async (req, res) => {
    const employee = await employeeById(req.params.id);
    const input = employeeInput.parse(req.body);
    const wasActive = employee.status === "active";
    Object.assign(employee, {
      ...input,
      employeeNumber: input.employeeNumber || employee.employeeNumber,
    });
    if (wasActive && input.status === "inactive") employee.sessionVersion++;
    await employee.save();
    await audit(
      req,
      "updated an employee account",
      `${employee.firstName} ${employee.lastName}`,
    );
    res.json({ employee: safeUser(employee) });
  });
  admin.patch("/employees/:id/status", async (req, res) => {
    const employee = await employeeById(req.params.id);
    const { status } = z
      .object({ status: z.enum(["active", "inactive"]) })
      .parse(req.body);
    await User.updateOne(
      { _id: employee._id },
      { $set: { status }, $inc: { sessionVersion: 1 } },
    );
    await audit(
      req,
      status === "active"
        ? "reactivated an employee"
        : "deactivated an employee",
      `${employee.firstName} ${employee.lastName}`,
    );
    res.json({
      message: `Account ${status === "active" ? "reactivated" : "deactivated"}.`,
    });
  });
  admin.post(
    "/employees/:id/reset-password",
    passwordLimit,
    async (req, res) => {
      const employee = await employeeById(req.params.id);
      const input = z
        .object({ temporaryPassword: password, confirmPassword: z.string() })
        .refine((d) => d.temporaryPassword === d.confirmPassword, {
          path: ["confirmPassword"],
          message: "Passwords do not match.",
        })
        .parse(req.body);
      await User.updateOne(
        { _id: employee._id },
        {
          $set: {
            passwordHash: await hashPassword(input.temporaryPassword),
            mustChangePassword: true,
          },
          $inc: { sessionVersion: 1 },
        },
      );
      await audit(
        req,
        "reset an employee’s temporary password",
        employee.username,
      );
      res.json({
        message:
          "Temporary password reset. Existing sessions have been revoked.",
      });
    },
  );
  admin.delete("/employees/:id", async (req, res) => {
    const employee = await employeeById(req.params.id);
    if (req.body.confirmation !== employee.username)
      fail(422, "Type the exact username to confirm deletion.");
    // A promoted employee keeps a linked trainer profile; remove it too so no
    // orphaned sign-in account or module assignment survives the deletion.
    const linked = await Trainer.findOne({ userId: employee._id });
    if (linked) {
      await Module.updateMany(
        { trainerId: linked._id },
        { $set: { trainerId: null } },
      );
      await Trainer.deleteOne({ _id: linked._id });
      await removeImage(linked.imageUrl);
    }
    // Remove the account first: all existing sessions fail authorization immediately.
    await User.deleteOne({ _id: employee._id });
    await Progress.deleteMany({ employeeId: employee._id });
    await TrainingAttempt.deleteMany({ employeeId: employee._id });
    await Certificate.deleteMany({ employeeId: employee._id });
    await audit(
      req,
      "permanently deleted an employee account and progress",
      employee.username,
    );
    res.json({ message: "Employee account and training progress deleted." });
  });
  admin.get("/trainers", async (req, res) => {
    const trainers = await Trainer.find().sort({ createdAt: -1 });
    res.json({
      trainers: await Promise.all(trainers.map(trainerView)),
      modules: await moduleViews(),
    });
  });
  admin.post("/trainers", upload.single("image"), async (req, res) => {
    // The administrator provides the trainer's sign-in ID and password.
    const input = trainerCreate.parse({
      ...parseTrainer(req.body),
      username: req.body.username,
      temporaryPassword: req.body.temporaryPassword,
      confirmPassword: req.body.confirmPassword,
    });
    if (!req.file) fail(422, "A trainer profile picture is required.");
    if (await Trainer.exists({ nicknameKey: input.nickname.toLowerCase() }))
      fail(409, "That trainer nickname is already in use.");
    if (await User.exists({ username: input.username }))
      fail(409, "That trainer ID is already in use. Choose a different one.");
    const imageUrl = await saveImage(req.file);
    let account;
    try {
      account = await User.create({
        firstName: input.firstName,
        lastName: input.lastName,
        age: input.age,
        username: input.username,
        role: "trainer",
        passwordHash: await hashPassword(input.temporaryPassword),
        mustChangePassword: true,
        status: input.status,
      });
    } catch (e) {
      await removeImage(imageUrl);
      throw e;
    }
    let trainer;
    try {
      trainer = await Trainer.create({
        firstName: input.firstName,
        lastName: input.lastName,
        nickname: input.nickname,
        nicknameKey: input.nickname.toLowerCase(),
        age: input.age,
        imageUrl,
        status: input.status,
        permissions: input.permissions,
        userId: account._id,
        introduction:
          input.introduction ||
          `Welcome to Zero Incident! I’m ${input.nickname}, your safety guide. Let’s build safer habits, one module at a time.`,
      });
    } catch (e) {
      await User.deleteOne({ _id: account._id });
      await removeImage(imageUrl);
      throw e;
    }
    await assignModules(trainer._id, input.moduleKeys);
    await audit(req, "created a trainer with a sign-in account", trainer.nickname);
    res.status(201).json({ trainer: await trainerView(trainer) });
  });
  admin.post(
    "/trainers/:id/reset-password",
    passwordLimit,
    async (req, res) => {
      const trainer = await trainerById(req.params.id);
      if (!trainer.userId)
        fail(409, "This trainer has no sign-in account.");
      const input = z
        .object({ temporaryPassword: password, confirmPassword: z.string() })
        .refine((d) => d.temporaryPassword === d.confirmPassword, {
          path: ["confirmPassword"],
          message: "Passwords do not match.",
        })
        .parse(req.body);
      await User.updateOne(
        { _id: trainer.userId },
        {
          $set: {
            passwordHash: await hashPassword(input.temporaryPassword),
            mustChangePassword: true,
          },
          $inc: { sessionVersion: 1 },
        },
      );
      await audit(
        req,
        "reset a trainer’s temporary password",
        trainer.nickname,
      );
      res.json({
        message:
          "Temporary password reset. The trainer must set a new password at next sign-in.",
      });
    },
  );
  admin.get("/trainers/:id", async (req, res) =>
    res.json({
      trainer: await trainerView(await trainerById(req.params.id)),
      modules: await moduleViews(),
    }),
  );
  admin.patch("/trainers/:id", upload.single("image"), async (req, res) => {
    const trainer = await trainerById(req.params.id);
    const input = parseTrainer(req.body);
    const exists = await Trainer.exists({
      nicknameKey: input.nickname.toLowerCase(),
      _id: { $ne: trainer._id },
    });
    if (exists) fail(409, "That trainer nickname is already in use.");
    const oldImage = trainer.imageUrl;
    const imageUrl = await saveImage(req.file);
    Object.assign(trainer, {
      ...input,
      nicknameKey: input.nickname.toLowerCase(),
      ...(imageUrl ? { imageUrl } : {}),
    });
    try {
      await trainer.save();
    } catch (e) {
      await removeImage(imageUrl);
      throw e;
    }
    await assignModules(trainer._id, input.moduleKeys);
    if (imageUrl) await removeImage(oldImage);
    await audit(req, "updated a virtual trainer", trainer.nickname);
    res.json({ trainer: await trainerView(trainer) });
  });
  admin.patch("/trainers/:id/status", async (req, res) => {
    const trainer = await trainerById(req.params.id);
    const { status } = z
      .object({ status: z.enum(["active", "inactive"]) })
      .parse(req.body);
    trainer.status = status;
    await trainer.save();
    await audit(
      req,
      status === "active"
        ? "activated a virtual trainer"
        : "deactivated a virtual trainer",
      trainer.nickname,
    );
    res.json({ message: "Trainer status updated." });
  });
  admin.delete("/trainers/:id", async (req, res) => {
    const trainer = await trainerById(req.params.id);
    if (req.body.confirmation !== trainer.nickname)
      fail(422, "Type the exact nickname to confirm deletion.");
    await Module.updateMany(
      { trainerId: trainer._id },
      { $set: { trainerId: null } },
    );
    await Trainer.deleteOne({ _id: trainer._id });
    if (trainer.userId) await User.deleteOne({ _id: trainer.userId });
    await removeImage(trainer.imageUrl);
    await audit(req, "deleted a virtual trainer", trainer.nickname);
    res.json({ message: "Trainer deleted. Its modules are now unassigned." });
  });

  // ---- Promotion applications (approve / reject) ----------------------------
  admin.get("/applications", async (req, res) => {
    const applications = await Application.find()
      .sort({ status: 1, createdAt: -1 })
      .populate("applicantId", "firstName lastName username role")
      .lean();
    const withContext = [];
    for (const a of applications) {
      const context = {};
      if (a.applicantId) {
        const rows = await Progress.find({
          employeeId: a.applicantId._id,
        }).lean();
        context.progress = progressSummary(rows);
        context.scores = MODULE_KEYS.map((key) => ({
          key,
          score: rows.find((r) => r.moduleKey === key)?.score ?? null,
        }));
      }
      if (a.type === "admin" && a.applicantId) {
        const profile = await Trainer.findOne({ userId: a.applicantId._id }).lean();
        if (profile)
          context.trainer = {
            nickname: profile.nickname,
            eligibility: await trainerAdminEligibility(profile),
          };
      }
      withContext.push({
        id: String(a._id),
        type: a.type,
        status: a.status,
        message: a.message,
        createdAt: a.createdAt,
        decidedAt: a.decidedAt || null,
        applicant: a.applicantId
          ? {
              id: String(a.applicantId._id),
              name: `${a.applicantId.firstName} ${a.applicantId.lastName}`,
              username: a.applicantId.username,
              role: a.applicantId.role,
            }
          : null,
        ...context,
      });
    }
    res.json({ applications: withContext });
  });
  admin.post("/applications/:id/approve", async (req, res) => {
    const application = await Application.findById(validId(req.params.id));
    if (!application || application.status !== "pending")
      fail(404, "Application not found or already decided.");
    const applicant = await User.findById(application.applicantId);
    if (!applicant) fail(404, "Application not found.");
    if (application.type === "trainer") {
      if (applicant.role !== "employee")
        fail(409, "This employee's role has changed since applying.");
      const { eligible } = await trainerEligibility(applicant._id);
      if (!eligible)
        fail(
          409,
          "The employee no longer has 90/100 or higher in every module.",
        );
      let nickname = applicant.firstName;
      let nicknameKey =
        nickname.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "trainer";
      let n = 2;
      while (await Trainer.exists({ nicknameKey })) {
        nickname = `${applicant.firstName} ${n}`;
        nicknameKey = `${nickname.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        n += 1;
      }
      await Trainer.create({
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        nickname,
        nicknameKey,
        imageUrl: "",
        permissions: { viewProgress: true, resetPassword: true },
        userId: applicant._id,
        introduction:
          application.message ||
          `Welcome to Zero Incident! I’m ${nickname}, your safety guide.`,
      });
      applicant.role = "trainer";
      await applicant.save();
      await audit(
        req,
        "approved a trainer application",
        `${applicant.firstName} ${applicant.lastName}`,
      );
    } else {
      if (applicant.role !== "trainer")
        fail(409, "This trainer's role has changed since applying.");
      const profile = await Trainer.findOne({ userId: applicant._id });
      const eligibility = profile
        ? await trainerAdminEligibility(profile)
        : { eligible: false };
      if (!eligibility.eligible)
        fail(
          409,
          "The trainer no longer meets the promotion requirements (tenure and certified employees).",
        );
      applicant.role = "admin";
      await applicant.save();
      await audit(
        req,
        "approved an administrator application",
        `${applicant.firstName} ${applicant.lastName}`,
      );
    }
    application.status = "approved";
    application.decidedBy = req.user._id;
    application.decidedAt = new Date();
    await application.save();
    res.json({
      message:
        application.type === "trainer"
          ? "The employee is now a trainer."
          : "The trainer is now an administrator.",
    });
  });
  admin.post("/applications/:id/reject", async (req, res) => {
    const application = await Application.findById(validId(req.params.id));
    if (!application || application.status !== "pending")
      fail(404, "Application not found or already decided.");
    application.status = "rejected";
    application.decidedBy = req.user._id;
    application.decidedAt = new Date();
    await application.save();
    const applicant = await User.findById(application.applicantId);
    await audit(
      req,
      `rejected a ${application.type} application`,
      applicant ? `${applicant.firstName} ${applicant.lastName}` : "unknown",
    );
    res.json({ message: "Application rejected." });
  });
  admin.get("/trainer-reports", async (req, res) => {
    const rows = await TrainerReport.find()
      .sort({ status: 1, createdAt: -1 })
      .populate("userId", "firstName lastName username role")
      .populate("trainerId", "nickname")
      .lean();
    res.json({
      open: rows.filter((r) => r.status === "open").length,
      reports: rows.map((r) => ({
        id: String(r._id),
        employee: r.userId
          ? {
              name: `${r.userId.firstName} ${r.userId.lastName}`,
              username: r.userId.username,
            }
          : { name: "Unknown", username: "" },
        trainer: r.trainerId?.nickname || "Trainer",
        moduleKey: r.moduleKey,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt || null,
      })),
    });
  });
  admin.post("/trainer-reports/:id/resolve", async (req, res) => {
    const report = await TrainerReport.findById(validId(req.params.id));
    if (!report) fail(404, "Report not found.");
    if (report.status === "resolved")
      fail(409, "This report has already been resolved.");
    report.status = "resolved";
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();
    await report.save();
    await audit(
      req,
      "resolved a trainer report",
      report.trainerId?.nickname || "trainer",
    );
    res.json({ message: "Report marked as resolved." });
  });
  admin.get("/progress", async (req, res) => {
    const employees = await User.find({
      role: { $in: ["employee", "trainer"] },
    })
      .sort({ firstName: 1 })
      .lean();
    const rows = await Progress.find().lean();
    res.json({
      employees: await withPercents(employees, rows),
      modules: await moduleViews(),
      demoMode,
    });
  });
  admin.patch("/profile", async (req, res) => {
    const input = z
      .object({ firstName: name, lastName: name, username })
      .parse(req.body);
    const user = await User.findById(req.user._id).select("+passwordHash");
    if (
      input.username !== user.username &&
      !(await verifyPassword(req.body.currentPassword, user.passwordHash))
    )
      fail(422, "Enter your current password to change your username.");
    Object.assign(user, input);
    await user.save();
    await audit(req, "updated their administrator profile", user.username);
    res.json({ user: safeUser(user) });
  });

  // ---- Trainer workspace ----------------------------------------------------
  // Trainers sign in with the ID and password the administrator provides.
  // What a trainer may do (view progress, reset passwords) is assigned per
  // trainer by the administrator; trainers can never delete employee IDs.
  function requireTrainer(req, res, next) {
    if (req.user.role !== "trainer")
      return next(new HttpError(403, "Trainer access is required.", "FORBIDDEN"));
    Trainer.findOne({ userId: req.user._id })
      .then((trainer) => {
        if (!trainer || trainer.status !== "active")
          return next(
            new HttpError(
              404,
              "Your trainer profile is missing or inactive. Contact your administrator.",
            ),
          );
        req.trainer = trainer;
        next();
      })
      .catch(next);
  }
  const trainer = express.Router();
  api.use("/trainer", requireAuth, requireReady, requireTrainer, trainer);

  trainer.get("/me", async (req, res) => {
    const [profile, rows, application, eligibility] = await Promise.all([
      trainerView(req.trainer),
      Progress.find({ employeeId: req.user._id }).lean(),
      Application.findOne({
        applicantId: req.user._id,
        type: "admin",
      }).sort({ createdAt: -1 }).lean(),
      trainerAdminEligibility(req.trainer),
    ]);
    res.json({
      trainer: profile,
      ownProgress: progressSummary(rows),
      adminApplication: application,
      adminEligibility: eligibility,
      canApplyAdmin: eligibility.eligible,
    });
  });
  trainer.get("/employees", async (req, res) => {
    if (!req.trainer.permissions.viewProgress)
      return next403Permission("view employee progress");
    const employees = await User.find({
      role: { $in: ["employee", "trainer"] },
    })
      .sort({ firstName: 1 })
      .lean();
    const [rows, percents] = await Promise.all([
      Progress.find().lean(),
      modulePercentMaps(employees.map((e) => e._id)),
    ]);
    res.json({
      employees: employees.map((e) => {
        const map = percents.get(String(e._id)) || {};
        return {
          ...safeUser(e),
          progress: progressSummary(
            rows.filter((p) => String(p.employeeId) === String(e._id)),
          ),
          // Completion percentage per module plus the overall figure.
          modulePercents: map,
          overallPercent: overallPercent(map),
        };
      }),
      modules: await moduleViews(),
    });
  });
  trainer.post(
    "/employees/:id/reset-password",
    passwordLimit,
    async (req, res) => {
      if (!req.trainer.permissions.resetPassword)
        return next403Permission("reset employee passwords");
      const employee = await employeeById(req.params.id);
      const input = z
        .object({ temporaryPassword: password, confirmPassword: z.string() })
        .refine((d) => d.temporaryPassword === d.confirmPassword, {
          path: ["confirmPassword"],
          message: "Passwords do not match.",
        })
        .parse(req.body);
      await User.updateOne(
        { _id: employee._id },
        {
          $set: {
            passwordHash: await hashPassword(input.temporaryPassword),
            mustChangePassword: true,
          },
          $inc: { sessionVersion: 1 },
        },
      );
      await audit(
        req,
        "reset an employee’s temporary password",
        employee.username,
      );
      res.json({
        message:
          "Temporary password reset. The employee must set a new password at next sign-in.",
      });
    },
  );
  trainer.post("/apply-admin", async (req, res) => {
    const message = applicationMessage.parse(req.body.message || "");
    const eligibility = await trainerAdminEligibility(req.trainer);
    if (!eligibility.eligible)
      fail(
        409,
        `Trainers can apply for an administrator position after ${eligibility.minDays} active days (you have ${eligibility.daysActive}) and ${eligibility.minCertified} employees certified under their guidance (you have ${eligibility.certified}).`,
      );
    const existing = await Application.findOne({
      applicantId: req.user._id,
      type: "admin",
      status: "pending",
    });
    if (existing)
      fail(409, "Your application is already under review.");
    const application = await Application.create({
      applicantId: req.user._id,
      type: "admin",
      message,
    });
    await audit(
      req,
      "applied for an administrator position",
      `${req.user.firstName} ${req.user.lastName}`,
    );
    res.status(201).json({ application: application.id });
  });
  function next403Permission(action) {
    throw new HttpError(
      403,
      `Your administrator has not given you permission to ${action}.`,
      "PERMISSION_DENIED",
    );
  }
  app.use(
    "/media/trainers",
    requireAuth,
    requireReady,
    express.static(UPLOAD_DIR, {
      dotfiles: "deny",
      maxAge: "1d",
      fallthrough: false,
    }),
  );
  api.use((req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  app.use(
    express.static(path.join(ROOT, "public"), {
      dotfiles: "deny",
      index: "index.html",
    }),
  );
  app.use((req, res) => res.status(404).send("Not found"));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof z.ZodError)
      return res.status(422).json({
        error: "Please check the highlighted fields.",
        fields: Object.fromEntries(
          error.issues.map((i) => [i.path[0] || "form", i.message]),
        ),
      });
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "value";
      const label =
        field === "employeeNumber"
          ? "employee ID"
          : field === "nicknameKey"
            ? "trainer nickname"
            : field;
      return res.status(409).json({
        error: `That ${label} is already in use. Choose a different one.`,
        fields: { [field]: `This ${label} is already in use.` },
      });
    }
    if (error instanceof multer.MulterError)
      return res.status(422).json({
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? "The image must be no larger than 5 MB."
            : "Invalid image upload. Choose one JPG, PNG or WebP.",
      });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ error: "Invalid JSON request." });
    const status = error.status || 500;
    if (status >= 500) console.error("Request failed:", error.message);
    res.status(status).json({
      error:
        status >= 500
          ? "Something went wrong. Please try again."
          : error.message,
      ...(error.code ? { code: error.code } : {}),
    });
  });
  return app;
}
