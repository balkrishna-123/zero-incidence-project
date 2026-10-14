# Architecture & implementation notes

## 1. Scope and roles

The three project roles map to **two authenticated account types** plus a managed character:

| Project role | Implementation | Can sign in? |
|---|---|---|
| Admin | `User` with `role: admin` | Yes |
| Employee | `User` with `role: employee` | Yes |
| Trainer | `Trainer` character profile | No |

There is no open self-registration. The operator bootstraps the initial administrator; that administrator registers employees and virtual trainers.

The brief now covers Manual Handling, Working at Height and Hazard Perception. All employees see these three mandatory modules; there is no optional assignment checkbox that could bypass certification requirements.

## 2. Technology

- Plain HTML, CSS and browser JavaScript modules; no frontend framework or build step.
- Express on Node.js, serving the frontend and JSON API on the same origin.
- MongoDB through Mongoose.
- Locally bundled Three.js for all three procedural warehouse training scenes; no CDN or frontend build step.
- `express-session` and `connect-mongo` for server-side sessions.
- Node crypto for salted scrypt password hashes.
- Zod for request validation, Multer for bounded uploads, Sharp for image decoding/re-encoding.
- Helmet, server-side authorization, CSRF tokens and request / credential-operation rate limits.
- Supertest / Node test runner for API checks, Playwright for browser smoke tests.

The hosted preview binds to `0.0.0.0`. Browser code uses relative `/api` and `/media` URLs, never `localhost` URLs pointing at a separate backend.

## 3. Authentication state machine

```text
Unauthenticated
    |
    | correct username + temporary password
    v
Authenticated, mustChangePassword = true
    |  /api/session and first-password/logout endpoints are available
    |  admin and employee learning APIs are blocked
    |
    | different valid new password + matching confirmation
    v
Password hash replaced; sessionVersion incremented
    |
    | session destroyed; redirected to login
    v
Unauthenticated
    |
    | correct username + the employee's own password
    v
Authenticated, mustChangePassword = false
    |
    +-- admin -> admin console
    +-- employee -> own training hub
```

At every protected request, the middleware reads the current user from the database. It checks that the account exists, is active, matches the session version and has not exceeded the absolute session lifetime. Role and mandatory-password guards are then applied.

- Deactivation increments the session version and blocks login.
- Password reset increments the version, replaces the hash and restores the mandatory-change flag.
- A self-service password change increments the version and logs the user out.
- Deletion removes the account; every old session immediately fails its next authorization check.
- Login regenerates the session ID to prevent session fixation.
- First-password updates use a compare-and-set condition on the stored session version, avoiding an older session overwriting an intervening reset.

## 4. Models and relationships

### User

`firstName`, `lastName`, `age`, `employeeNumber`, `username`, `passwordHash`, `role`, `status`, `mustChangePassword`, `sessionVersion`, sign-in / password-change timestamps, `isDemo`, created/updated timestamps.

- `username`: unique, lowercased, 3–40 characters.
- `employeeNumber`: unique sparse index; omitted for admins.
- `passwordHash`: excluded from default queries and every API serializer.
- Only employee creation is exposed to administrators. Client-supplied roles and mandatory-change flags cannot promote a user or bypass first-login setup.
- Age is required for employees, 16–100, matching the provided screen’s adult-workplace onboarding convention. Confirm this range with the client.

### Trainer

`firstName`, `lastName`, `nickname`, case-normalized unique `nicknameKey`, optional character `age`, `imageUrl`, `introduction`, `status`, timestamps.

Contains **no credential fields**. The nickname is unique without regard to case. A trainer’s age is descriptive character information, not employee identity data.

### Module

One record for each stable key:

- `manual-handling`
- `working-at-height`
- `hazard-perception`

Contains title, description, objectives, rules and an optional `trainerId` reference. One trainer may guide multiple modules, but a module has only one assigned trainer.

Deactivation preserves the assignment but hides the trainer from employee responses. Reactivation restores visibility. Deletion clears assignments. Assigning a different trainer replaces the prior reference.

### Progress

Unique compound index: `(employeeId, moduleKey)`.

Contains a 0–100 score, attempt count, assessment timestamp and `source` (`demo` or `assessment`). No record means **not started**; the API always builds a three-module view, including missing scores as `null`.

All three modules update this summary from validated completed attempts. Additional fields are `bestAttemptId`, `activityScore`, `quizScore`, `lastScore` and `lastAssessedAt`. A demonstration or unproven legacy score is replaced by the first genuine assessment; subsequent best scores can only improve.

### TrainingAttempt

Stores owner, module key, fixed course version, phase, ordered/shuffled question IDs and option orders, inspected objects, immutable first activity/quiz responses, deadlines, completion time and total/breakdown. The compound partial unique index permits only one open attempt per owner/module. Mongoose optimistic concurrency and replay checks protect against duplicate submissions. Quiz expiry is reconciled on the server, including when an attempt is resumed. Completed attempts are retained as history and removed with confirmed employee deletion. Read `docs/MANUAL-HANDLING.md` for content-version limits.

### Counter

An atomic counter generates employee IDs such as `ZI-2026-1007`. A unique database index also protects against manually entered duplicate IDs.

### Audit

Actor ID/name, action, subject and timestamp. No credentials are included. Deletion leaves audit history intact; production retention/pseudonymization policies need organisational decisions.

### Sessions

`connect-mongo` stores session data and expiry in MongoDB. The browser only holds an opaque HttpOnly session cookie, not a readable user profile or password.

```text
User (employee)  1 ───── n  Progress  n ───── 1  Module
                                                   |
                                                   n
                                                   |
                                                   1
                                                 Trainer

User / server operator ───── creates Audit events
```

## 5. API contract

All responses are JSON unless serving a static file or trainer image. Errors use:

```json
{
  "error": "Human-readable message",
  "code": "OPTIONAL_MACHINE_CODE",
  "fields": { "username": "Optional field-specific message" }
}
```

### Session and authentication

| Method | Route | Access / purpose |
|---|---|---|
| GET | `/api/health` | Database readiness indicator |
| GET | `/api/session` | Current safe user, CSRF token and development-only demo configuration |
| POST | `/api/auth/login` | Validate credentials, regenerate session |
| POST | `/api/auth/logout` | Destroy the current session |
| POST | `/api/auth/first-password` | Authenticated account with mandatory setup pending |
| POST | `/api/auth/change-password` | Ready account; requires current password |

First call `GET /api/session`. Include its `csrfToken` as `X-CSRF-Token` on **all** POST, PATCH and DELETE requests, including login. Login regenerates the token; the frontend API helper automatically adopts the new one.

### Admin-only

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/admin/overview` | Counts, recent employees, audit activity and module assignments |
| GET | `/api/admin/employees` | Search/filter/paginate employees |
| POST | `/api/admin/employees` | Register employee; always requires first-password setup |
| GET | `/api/admin/employees/:id` | Account details and derived progress |
| PATCH | `/api/admin/employees/:id` | Update personal/account information |
| PATCH | `/api/admin/employees/:id/status` | Activate/deactivate; revoke sessions |
| POST | `/api/admin/employees/:id/reset-password` | Issue a new temporary password and revoke sessions |
| DELETE | `/api/admin/employees/:id` | Delete account and progress; exact username confirmation |
| GET | `/api/admin/trainers` | List virtual trainers with assignments |
| GET | `/api/admin/trainers/:id` | Trainer detail and available modules |
| POST | `/api/admin/trainers` | Multipart trainer creation with required image |
| PATCH | `/api/admin/trainers/:id` | Multipart edit; replacement image optional |
| PATCH | `/api/admin/trainers/:id/status` | Activate/deactivate virtual character |
| DELETE | `/api/admin/trainers/:id` | Delete image/profile and clear assignments; exact nickname confirmation |
| GET | `/api/admin/progress` | All employee summary results |
| PATCH | `/api/admin/profile` | Admin name/username; current password required to change username |

Employee list query parameters: `search`, `status=active|inactive`, `onboarding=true`, `page`, `limit` (maximum 50).

Trainer multipart field `moduleKeys` is a JSON string array. Images must be still JPG, PNG or WebP. MIME labels alone are not trusted: Sharp must decode a supported image before it is saved under a random UUID filename.

### Employee and media

| Method | Route | Access / purpose |
|---|---|---|
| GET | `/api/me/training` | Ready employee only: own module view and progress |
| GET | `/media/trainers/:filename` | Authenticated, ready account: processed trainer image |

### Released training modules (ready employee only; owner checks on every attempt)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/training/manual-handling` | Public lesson fields, assigned active trainer, own history and active attempt |
| GET | `/api/training/working-at-height` | Public lesson fields, assigned active trainer, own history and active attempt |
| POST | `/api/training/:moduleKey/start` | Acknowledged start, or resume the existing open attempt |
| GET | `/api/training/attempts/:id` | Resume state; reconcile server-side question expiry |
| POST | `/api/training/attempts/:id/inspect` | Inspect the current checkpoint |
| POST | `/api/training/attempts/:id/activity-answer` | Record the first validated practical response |
| POST | `/api/training/attempts/:id/quiz/next` | Begin the next question without resetting an existing deadline |
| POST | `/api/training/attempts/:id/quiz/answer` | Record an answer/skip or reconcile a timeout |

All POSTs require the same CSRF protections as the existing app. Correct answers are not sent before the response/timeout; the private bank is outside `public/`. Requests cannot supply totals. All three module keys are supported; unknown keys are rejected. Hazard Perception additionally uses the classification endpoint below. There is still no public admin sign-up or email-reset sender. Certificate APIs are described in the release 1.5 section below.

## 6. Scoring boundary

`progressSummary()` in `server/models.js` is the shared source of truth:

- Score >= 85: Excellent.
- Score >= 70 and below 85: Pass.
- Score below 70: Retake.
- Missing score: Not started.
- Overall average: computed with equal weight, only if all three scores exist.
- Eligible: `all three module scores >= 70`.

Example: `[100, 100, 69]` has an average above 70 but remains **ineligible**. `[70, 70, 70]` is eligible. These boundaries are covered by integration checks.

A progress value of 100% means all three modules passed, not merely that all were attempted. Eligibility does not mean a certificate was issued. Certificates are generated only from independently verified completed attempts; this raw mathematical eligibility flag alone is not sufficient.

## 7. Preview versus deployment

Local development uses an actual MongoDB WiredTiger database in `data/mongodb`. External MongoDB/Atlas is selected when `MONGODB_URI` is configured.

HTTPS development previews can be embedded cross-site, so their cookies are Secure, SameSite=None and partitioned. Plain HTTP local development uses SameSite=Lax. Production is unframed, uses SameSite=Lax and requires a configured strong session secret. Synchronizer CSRF checks remain active in every mode.

The preview intentionally includes known admin credentials and fictional accounts. Use a clean database and disable demo mode for a real installation. Production startup rejects databases containing labelled demo accounts.

Uploads and database backups need durable storage. Multi-document destructive operations are sequenced for safe authorization but are not transactional on the standalone development MongoDB instance. A production replica-set deployment should add transactions or compensating cleanup for deletion/assignment operations, and an operational reconciliation job.

Rate limits in this prototype are process-local. Use a shared store and appropriate identity/IP keys before horizontally scaling. MFA, email recovery, full audit retention rules and external monitoring are not implemented.

## 8. Confirmed module plan and remaining decisions

The user selected a procedural interactive 3D warehouse and **70 activity / 30 quiz marks** per module. Manual Handling implements five 14-mark checkpoints and five 6-mark questions, with 20 seconds per question and a 70-point pass threshold. Best assessed results are kept; 85–100 earns three stars, 70–84 two, and below 70 one with a below-pass result. A trainer character presents the system’s feedback and cannot invent or override a score.

All three modules and verified certificate generation are released. The shared server state machine resolves questions and best-score writes using the stored attempt’s module key. Legacy Manual Handling records remain readable without a migration; the browser rejects a mismatched module/attempt URL. Open attempts, history and best scores are separate per employee/module. Remaining deployment decisions include safety-content sign-off, assessed-time accommodations, certificate format/expiry/verification, data retention and production operations. No practical competence or legal authorisation is implied by completing this prototype.

Attempt completion, Progress updates and audit logging are separate idempotent operations on the standalone development database. Result reads reconcile missing Progress updates. Production still needs monitoring, failure-injection/recovery testing and transactional/compensating handling of destructive cross-document races.


## 9. Release 1.3 UI and scene reuse

The module page entry files load the shared `learning-module.js` controller with a released module key. `module-views.js` supplies the appropriate reading guide, presentation and lazy scene factory. The shared warehouse renderer retains the original Manual props and adds Height-specific equipment through a separate builder. Both support projected markers, object picking, keyboard look/zoom, non-WebGL Inspect controls, reduced-motion focus changes and explicit GPU/timer cleanup on navigation.

There are no climbing controls or practical competence checks. A digital learning completion certificate issuer is now available. Passing Working at Height is a record of the prototype knowledge/decision assessment, not equipment approval or permission to work.


## 10. Hazard Perception 1.4 state and scoring

Hazard Perception uses the same owned attempt/session boundary but a `hunt` activity mode. Inspection is free and can select any of eight areas. `POST /api/training/attempts/:id/classify` requires a prior inspection and accepts only `{ objectId, flagged: boolean }`. The first judgement is immutable and is marked against server-side course data. No correctness key is exposed before the judgement.

New optional attempt fields are `classifications` and `selectedObjectId`; the activity-answer subdocument gains `identificationCorrect`. Legacy guided attempts do not use them. Each real hazard offers 7 identification and 7 control-response marks. Incorrect flags on the three comparison areas are recorded uniquely in `safeFindings`, deducting two activity marks once per area. Activity score is clamped to 0–70. All eight classifications and all five hazard responses are required before the quiz phase. Quiz scoring/deadlines are unchanged.

The public attempt state includes only the selected observation, recorded judgements and the control prompt after classification. Completed results include the eight judgements and the five response/quiz breakdowns. A missed hazard can be explained and controlled for learning without regaining the lost identification marks. Renderer controls are demonstrations, not repair or site approval. Real uncertainty should always be reported; this exercise’s deduction must not discourage reporting.

The shared warehouse uses time-based camera interpolation and static shadow maps refreshed after scene-state changes. Hazard markers are compact until hovered/focused/selected to prevent crowded labels covering one another. The two earlier course definitions/versions are checked against the delivered 1.3 source, and legacy result/timestamp fixtures remain valid.


## 11. Verified completion and certificates (release 1.5)

`completion.js` recomputes completed attempt scores from actual option IDs and the matching course version. It validates ownership, phase/open state, checkpoint/inspection sets, quiz sequence and timeout/skip flags; Hazard classifications and one-time deductions are also checked. Summary scores or `source` labels alone are not proof. The best valid completed attempt is selected per module. The completion date is the latest of the first verified pass dates across the three modules. Learner completion views now use this evidence-based status; existing admin progress reporting can still include labelled samples.

`Certificate` has a unique `(employeeId, programVersion)` index and an immutable snapshot of identity, selected scores, timestamps, course versions and proof references. Issuance requires an active, ready employee, a reviewed recipient ID/summary key and the existing CSRF/auth guards. Repeated/concurrent requests return the same record. A raw PDF GET does not issue a record.

Snapshot and evidence SHA-256 digests bind the stored record to its selected assessment data. Read/download checks validate those bindings. They are consistency checks, not public-key signatures or proof against an unrestricted database operator. Historical certificate validation does not recompute against a later edited question bank: it checks the evidence bound at issuance. New issuance still requires the supported matching course version.

Authenticated endpoints: GET/POST `/api/me/certificate`, GET `/api/me/certificate/pdf`; administrator GET `/api/admin/certificates`, GET/POST `/api/admin/employees/:id/certificate` and GET `/api/admin/employees/:id/certificate/pdf`. There is no public PII lookup. The request body is `{recipientId, reviewKey}`; names/totals/dates/IDs supplied by the client are not accepted. A expected certificate ID can bind PDF downloads to the reviewed record.

PDFKit and Fontkit generate a one-page A4 landscape document with locally embedded Noto Sans/Devanagari fonts. Unsupported glyphs are rejected before issuance. Dates store UTC instants plus the issuance display timezone (default Asia/Kathmandu). No human signature, accreditation or permission to perform hazardous work is implied.

The new admin page provides search/filter/pagination, current verified summaries, issuance and historical PDF downloads. Inactive employees cannot access the app, but their historical records remain visible to admins; confirmed employee deletion also removes certificate data. Already downloaded copies cannot be recalled. Correction/reissue/revocation/expiry and public verification require an explicit organisational policy before adding them.
