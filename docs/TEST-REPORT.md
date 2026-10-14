# Verification record

**Project:** Zero Incident — complete learning/certificate prototype, release 1.5  
**Date:** 7 September 2026  
**Environment:** Node.js 20.20.2, real MongoDB 7.0.24, Chromium through Playwright; desktop 1440 × 1000 and mobile emulation 390 × 844.

## Automated API checks

Command: `npm test`

**11 integration scenarios passed (12 TAP tests including the parent suite), 0 failures.** Each run uses an isolated disposable MongoDB database and does not modify the running demo.

| Area | Verified |
|---|---|
| Authorization | Anonymous users cannot access admin APIs; protected source/environment files are not exposed |
| CSRF | Mutation/login requests without a valid synchronizer token are rejected |
| Admin bootstrap | Non-demo admin must change the initial password; protected routes remain blocked until then |
| Preview cookies | HTTPS development session cookie is HttpOnly, Secure, SameSite=None and Partitioned |
| Employee creation | Age/password confirmation validated; duplicate usernames rejected; auto employee ID; client cannot choose admin role or disable required setup |
| Password storage | Database stores a salted scrypt hash, not the supplied temporary password; API does not return the hash |
| First login | Training is blocked before password setup; same temporary/new password rejected; after change, old sessions and credentials fail |
| Role isolation | Ready employees cannot access admin APIs or submit a fabricated score |
| Account lifecycle | Edit, deactivate, reactivate and password reset work; inactive accounts cannot sign in; stale sessions lose access |
| Trainer media | Spoofed/non-image uploads rejected; valid images re-encoded to WebP; media requires authentication; module assignment and deactivation work |
| Result rules | Missing results are ineligible; `[100,100,69]` fails eligibility; a score of 70 passes; 84/85 classifications; scores outside 0–100 rejected |
| Self password change | Current password verified; successful change destroys/revokes prior sessions |
| Destructive actions | Incorrect confirmation rejected; confirmed employee deletion removes progress; trainer deletion clears module assignments |

## Browser smoke checks

Command: `npm run test:browser`

**All browser check groups passed. No uncaught browser JavaScript errors.** The script creates a separate app/database, then shuts both down.

1. Admin login; employee creation through the actual form; one-time credential dialog; employee search, details, edit, deactivation and reactivation.
2. Employee temporary login → mandatory new password → return to login → new-password login → three-module hub. Learning overviews, own progress, explicit Phase 2 certificate state and role-aware routing.
3. Trainer image upload, nickname/introduction, module assignment, search, deactivation and confirmed deletion.
4. Progress filtering, CSV download and settings screen.
5. Mobile login, responsive sidebar navigation, registration form and absence of page-level horizontal overflow.
6. Visual inspection of login, dark admin overview/registration, virtual trainer cards, light employee hub and mobile screens. The supplied trainer character renders without the surrounding screenshot UI.

## Dependency and persistence checks

- Production dependency audit: `npm audit --omit=dev` — **0 reported vulnerabilities** at verification time. The image-processing dependency was upgraded to the patched Sharp 0.35 series before the final checks.
- JavaScript syntax checked with `node --check`.
- The preview was stopped and restarted. Its existing MongoDB records were retained; demo seeding did not overwrite/recreate them.
- Uploaded images and local MongoDB files are separated from source code and excluded from the distributable ZIP.

## Not claimed / still required

This is not a penetration test, a safety-content certification, or a production readiness sign-off. The following remain to be done:

- Organisational certificate correction/revocation/reissue/expiry policy and any public verification requirement. The basic generation/download flow is covered below.
- Safety content review against the warehouse company’s procedures.
- Full manual Chrome/Edge/Firefox compatibility testing, screen-reader/accessibility audit, Safari/iOS checks and real-device testing. The mobile test above is browser emulation.
- Load/concurrency testing, backup/restore drills, replica-set transactions/cleanup resilience and shared-store rate limiting for multi-instance deployment.
- Production infrastructure, HTTPS/proxy configuration, persistent upload storage, privacy/retention policy and organisational approval.
- MFA, email-based recovery and certificate verification.

Dependency audit results are point-in-time, not a guarantee of future security. Re-run the audit and tests when changing dependencies or deploying.


## UI 1.1 regression update

The light/dark theme and visible sign-out update is covered by `npm run test:appearance`.
The additional suite verifies short-laptop and mobile control visibility, sticky header,
form/scroll preservation, theme persistence and cross-tab updates, light/dark dialogs,
separate role preferences, actual server logout and duplicate-click protection, recovery
from a rotated CSRF token, and operation with restricted local storage. The original API
and browser suites also pass. See [UI-UPDATE.md](UI-UPDATE.md) for the safe frontend-only
installation instructions. No data migration is required.


## Manual Handling 1.2 verification

- `npm test`: **12 TAP tests including the parent, 0 failures**. The old all-assessments-unavailable assertion now explicitly expects only Manual Handling to be available.
- `npm run test:manual`: **8 TAP tests including the parent, 0 failures**. Covers auth/CSRF/mandatory-password isolation; private answers; unreleased module rejection; unique open attempts; owner checks; ordered inspection; rejected fabricated totals; immutable concurrent responses; server deadlines/early timeout checks/reload; scoring; best-score retakes; the 70 boundary; demo-score replacement; admin reporting; deactivation and deletion.
- `npm run test:manual:browser`: **all check groups passed**, no uncaught browser errors. Includes actual rendered 3D and keyboard rotation; scene marker inspection; activity resume after reload; theme changes retaining the same canvas; a real 20-second timeout and automatic next question; a 94/100 result retained after reload; a zero-scoring retake retaining the best; mobile layouts; logout; and a 100/100 completion without WebGL via equivalent accessible controls.
- `npm run test:browser` and `npm run test:appearance`: **all existing groups passed**. Unreleased overview-dialog checks now open Working at Height instead of the newly playable Manual Handling route.
- `npm audit --omit=dev`: **0 reported vulnerabilities** at verification time.

Manual Handling browser coverage used desktop 1440 × 970, mobile 390 × 740 and no-WebGL 320 × 640 emulation. The scene is original procedural Three.js geometry; all dependencies/assets are local. Screenshots were inspected for the briefing, practical scene, quiz, result and responsive layout. These tests are not a formal accessibility, security, real-device or workplace safety certification.


## Working at Height 1.3 verification

Final regression runs on 6 September 2026:

| Command | Result |
|---|---|
| `npm test` | 12 TAP tests including parent; all passed |
| `npm run test:manual` | 8 TAP tests including parent; all passed |
| `npm run test:height` | 10 TAP tests including parent; all passed |
| `npm run test:browser` | All account/trainer/progress/browser checks passed |
| `npm run test:appearance` | All theme/logout/short-screen checks passed |
| `npm run test:manual:browser` | Full original Manual flow passed after controller/renderer reuse |
| `npm run test:height:browser` | All Height browser groups passed; no uncaught errors |
| `npm audit --omit=dev` | 0 reported vulnerabilities at verification time |

The Height API suite verifies legacy release-1.2 Manual history (including its 94/100 result and original completion timestamp), auth/readiness/CSRF, private answer keys, ordered inspection, rejected fabricated totals, immutable/concurrent responses, server-owned deadlines, best-score retakes, the 70 boundary, sample-score replacement, admin reporting, deactivation and deletion. It also checks that the two modules cannot overwrite one another’s answers, open attempts or progress, and that passing two modules does not satisfy three-module eligibility.

The Height browser suite verifies rendered 3D and keyboard rotation, scene-marker inspection, five checkpoints, resume after reload, theme switching without rebuilding the canvas, a real 20-second timeout and auto-next, a saved 94/100 result, a zero-score retake retaining the best, mobile layouts, sign-out, a wrong-module attempt URL guard, and a 100/100 completion through the no-WebGL fallback. Desktop is 1440 × 970; mobile emulation is 390 × 740 and 320 × 640. Scene/control screenshots and the blue light/dark layouts were reviewed.

The earlier baseline availability assertion now expects two playable modules, and overview-dialog checks use Hazard Perception. No authentication or score-protection checks were removed. Each run uses a disposable database. No real-device, full accessibility, penetration, practical competence or workplace safety certification is claimed.


## Hazard Perception 1.4 verification

- API suites: `npm test` **12/12**, `npm run test:manual` **8/8**, `npm run test:height` **10/10**, `npm run test:hazard` **11/11** TAP tests (counts include parent suites).
- All five browser suites passed: account flow, appearance/logout, Manual Handling, Working at Height and Hazard Perception. No uncaught browser errors were reported.
- Hazard API coverage includes three independent open attempts, legacy score/timestamp preservation, auth/readiness/CSRF/owner checks, free and repeatable inspection, immutable classifications, one-time deductions, no client totals, seven-plus-seven partial marking, eight-area/five-response gate, server timeouts/reload, 70/84/85 boundaries, best retention, sample replacement and deletion.
- Hazard browser coverage includes actual 3D and keyboard/marker interaction, non-linear inspection, a saved incorrect comparison judgement, theme/canvas preservation, a real 20-second timeout with auto-next, a saved 92/100 result, a 65/100 retake retaining the best, mobile layouts, logout, wrong-module URL rejection and a 100/100 completion through the 320px no-WebGL fallback.
- Screenshots of the briefing, active walk, control examples, quiz, results and mobile layout were inspected. Compact markers and time-based camera movement avoid the initial label-overlap and frame-rate-dependent focus issues found during testing.
- The earlier unavailable-module assertions now reject `unsafe-acts` instead; all three requested modules are expected to be available. Overview-modal checks now exercise a real module briefing or Help dialog. No auth or score-protection checks were removed.

These tests use disposable databases. They do not constitute workplace safety certification, a full accessibility audit, real-device coverage, penetration testing or production-load qualification. In real work, uncertain concerns must still be reported regardless of this exercise’s scoring rule.


## Final certificate flow 1.5 verification

Final regression runs on 7 September 2026:

- API suites: authentication **12/12**, Manual **8/8**, Height **10/10**, Hazard **11/11**, certificates **11/11** TAP tests (including parent suites).
- All six browser suites passed: account flow, appearance/logout, three module flows, and certificate flow. No uncaught browser errors were reported.
- Certificate checks prove that sample and fabricated summary scores cannot qualify; `[100,100,69]` stays locked despite an 89.7 average; a genuine final 70 unlocks issuance; stale/forged previews are rejected; concurrent generation yields one ID/date/audit event; PDFs are authenticated and one-page; later practice/profile changes preserve the issued snapshot; tampered snapshots/evidence block downloads; admin issuance and mixed Devanagari/Latin names work; deactivation preserves admin access while blocking the learner; deletion removes records.
- Browser checks cover locked/ready/issued states, duplicate clicks, actual PDF download, light/dark paper previews, current-vs-issued snapshot notices, admin search/filter/view/issue/download, and 390/320px layouts. The admin-avatar width found in visual inspection was corrected.
- PDF visual/text checks confirm a single A4 landscape page, correct module marks/overall score, readable Latin/Devanagari names and the non-authorisation notice. The generated output and browser previews were inspected.
- `npm audit --omit=dev`: **0 reported vulnerabilities** at verification time. PDFKit/Fontkit were added with locally bundled licensed fonts.

Older “no certificate endpoint / Phase 2 placeholder” assertions now check the appropriate locked state and absent issuance. A synthetic legacy fixture was completed with the inspection IDs that the actual old assessment flow records; no evidence validation was weakened. Tests use disposable databases, not the running app data. No production, practical competence, formal accessibility or penetration-test sign-off is claimed.
