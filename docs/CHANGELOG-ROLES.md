# Change summary — Roles & promotion (client meeting features)

Date: 2026-10-01 · Scope: server (models, routes, seed), frontend (admin console, trainer workspace, employee progress, login), tests.

The client asked for six things. All six are implemented and covered by automated tests (`npm test`, 18 tests) plus a live API smoke script.

## 1. Trainers sign in with an ID and password provided by the admin
- **New:** `POST /api/admin/trainers` now requires the trainer profile plus **`username`, `temporaryPassword`, `confirmPassword`**. The server creates a linked `User` account (role `trainer`) in the same request; if trainer creation fails, the account and uploaded image are rolled back.
- The trainer's first sign-in forces a new password (same mandatory first-password flow as employees).
- **New:** `POST /api/admin/trainers/:id/reset-password` — admin issues a fresh temporary password, revokes the trainer's sessions.
- Deleting a trainer also deletes the linked sign-in account.
- Admin console: the trainer form has a **Sign-in & permissions** section (create: username + temporary password; edit: read-only username + *Reset password* button). Trainer cards show the sign-in username, star total, and permission badges.

## 2. Trainer views employee progress and resets passwords — never deletes
- **New trainer workspace** (`/trainer/…`, light theme, its own sidebar):
  - **Overview** — permissions status, rating summary, quick actions.
  - **Employee progress** — every learner's module scores, overall, status (trainer role badge where relevant).
  - **My ratings & promotion** — star totals, recent ratings, administrator application.
- `GET /api/trainer/employees` and `POST /api/trainer/employees/:id/reset-password` are permission-gated (see 3).
- Trainers hit the employee routes only through their own endpoints; `DELETE /api/admin/employees/:id` still returns **403** for trainer sessions — employee IDs can only be removed by an administrator.

## 3. Admin assigns per-trainer permissions
- **New:** `Trainer.permissions` = `{ viewProgress, resetPassword }` (default both off).
- Admin toggles both checkboxes when creating or editing a trainer (`POST/PATCH /api/admin/trainers`, `permissions` as a JSON string in the multipart form).
- Permission changes apply immediately: a trainer whose *view progress* is switched off gets **403 `PERMISSION_DENIED`** on the next progress request.

## 4. Employee 90+ in every module → apply → approved → becomes trainer
- **New:** `POST /api/me/apply-trainer` (optional message ≤ 600 chars). Server rejects **409** unless every module score is ≥ 90; a pending application cannot be duplicated.
- **New admin page: Applications** (`/admin/applications`) — trainer applications show per-module scores; approve/reject buttons. `POST /api/admin/applications/:id/approve` re-validates eligibility, creates the trainer profile (permissions enabled), and flips the user's role to `trainer`. `POST /api/admin/applications/:id/reject` keeps them an employee and allows reapplying.
- Employee side: **My progress** shows a *Grow with us* card — eligibility note (x of 3 modules at 90+), an apply form when eligible, or a "pending / declined" status.
- Overview shows a **pending applications** callout; the admin sidebar has an **Applications** item.

## 5. Employees rate the trainer (Play-Store style stars)
- **New:** `POST /api/ratings` — `{ moduleKey, trainerId, stars 1–5, comment ≤ 280 }`. Rules enforced server-side: the trainer must be the module's assigned guide, the employee must have passed the module (≥ 70), and ratings are unique per employee + module (409 on repeat).
- Employee side: after passing a module, **My progress → Rate your guides** shows a 5-star input + comment box per passed, unrated module.
- Trainer side: **My ratings & promotion** lists recent ratings with stars and comments.

## 6. Trainer with 25+ stars → apply → approved → becomes a second admin
- **New:** `POST /api/trainer/apply-admin`. Requires **25+ total stars** (aggregate of all ratings on the trainer profile); below that → 409 with the current count.
- Applications page lists administrator applications with the trainer's star stats; approval flips the trainer's role to `admin` (their trainer profile and module assignments stay intact), so the workspace has **two administrators**. The new admin immediately has full console access.

## Demo seed (first demo initialization only)
- New demo trainer account **`yeti` / `Welcome!2026`** (must-change-password already satisfied, both permissions on) — instant trainer demo login from the login page's **Trainer workspace** button.
- `anisha.g` now scores **94 / 92 / 91** → the eligible trainer-applicant for the demo.
- 24 seeded stars on Yeti (7 ratings) → one more 5-star rating unlocks the 25+ administrator application demo.
- `/api/session` now reports `demoCredentials.trainerAvailable` and a `trainerId` for trainer sessions.

## Files changed
- `server/models.js` — role enum + `trainer`; `Trainer.userId`/`permissions`; new `Application` and `Rating` models (unique per user + module); `ratingStats()` aggregate.
- `server/app.js` — trainer creation with linked account + rollback; trainer password reset; `/api/trainer/*` router (`/me`, `/employees`, `/employees/:id/reset-password`, `/apply-admin`); `/me/apply-trainer`; `/ratings`; admin applications list/approve/reject; permission checks; role-aware roster queries; delete cascades; `/me/training` gains `ratedModules`, `trainerApplication`, `trainerEligible`.
- `server/seed.js`, `server/config.js` — demo trainer account, eligible employee, seeded stars, demo credential table.
- `public/js/trainer.js` (new) — trainer workspace pages.
- `public/js/admin.js` — trainer form sign-in/permissions, reset modal, trainer card badges, **Applications** page, overview pending-applications callout, role badge on employees.
- `public/js/employee.js` — *Grow with us* trainer-application card + *Rate your guides* star cards.
- `public/js/app.js`, `public/js/icons.js` (star, send), `public/js/theme.js` (trainer theme), `public/js/login.js` (trainer demo button), `public/styles.css` (rating/star/promotion/permission styles).
- `tests/integration.test.js` — trainer creation now supplies credentials; new coverage: trainer sign-in, permission lockout, admin trainer reset.
- `tests/promotion.test.js` (new) — ratings rules, trainer application (eligibility, approve, reject, reapply), admin application (25-star gate, approve, two admins).
- `README.md` — trainer demo credentials + *Roles and promotion* demo storyline.

## Testing
- `npm test` → 18/18 (11 original lifecycle tests, updated; 5 new promotion tests).
- Live smoke (fresh demo DB): 26/26 API checks across the six features, including the full Anisha → trainer and Yeti → admin promotion paths.

## 7. Follow-up from the demo: dedicated "Rate trainer" page + trainer reports
*Added after the first client demo, when the rating card (bottom of My progress) was hard to find and most demo employees were pre-rated in the seed data.*

- **Employee sidebar:** new **Rate trainer** item below *My progress* (`/employee/rate-trainer`).
- **Rate trainer page:** lists every module with an assigned guide; 1–5 stars per module with a Submit button; already-rated modules show the stars given plus a *Rated* badge (star values now come from `/me/training` → `myRatings`).
- **Rating rule relaxed:** rating a module no longer requires passing it first (per the latest client request — the page covers "each module"). Server still enforces: trainer must be assigned to that module and active; one rating per employee per module.
- **Report a trainer:** button on the same page opens a report form (which module's guide + what happened). `POST /api/me/trainer-reports` → stored with status *open*; `GET /api/me/trainer-reports` returns the employee's reports with live status.
- **Admin console:** new **Reports** page (`/admin/reports`, nav item below *Applications*) — employee, trainer, module, message, date, status, and a **Mark resolved** action (`POST /api/admin/trainer-reports/:id/resolve`). The overview shows an *open reports* callout (`stats.openTrainerReports`).
- **Model:** new `TrainerReport` (userId, trainerId, moduleKey?, message ≤ 600, status open/resolved, resolvedBy/At).
- **Seed:** one open demo report (Nisha Magar → Yeti, Manual handling) so the admin page demonstrates immediately.
- **Tests:** rating test updated for the relaxed rule (no pass requirement); new subtest covers report validation (422 empty message, 409 wrong module), employee view, admin view, resolve, double-resolve 409, and the overview count. `npm test` → 19/19.
