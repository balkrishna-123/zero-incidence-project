> **Release 1.7 — module journey.** All three modules now share a journey flow that **supersedes** the activity curriculum below: a virtual-trainer introduction, then three levels of study in a rotatable **360° view** (full-screen available) with increasing depth (4 → 5 → 6 study sections), each followed by an **eight-question quiz** (twenty-four per module, 20 seconds per question — a timeout is charged like a wrong attempt). Questions must be answered correctly to continue; wrong attempts dock 25 marks and can be retried; a **trainer hint** is available. The **final result is the average of all nine question scores** and unlocks only after the last quiz; **70/100 passes, 85+ is Excellent**. The Working-at-Height lesson content below is retained as the Level 1–3 study curriculum reference. See the README *Module journey — release 1.7 curriculum* section.

# Working at Height — release 1.3

> **Current release: 1.5.** The verified completion and PDF certificate flow is implemented. Use [CERTIFICATES.md](CERTIFICATES.md) for the latest installation and record policy. The curriculum and original release details below are retained for reference; genuine existing results are preserved.


> **Historical release note (1.4).** All three modules are now playable; certificate generation is next. Use [HAZARD-PERCEPTION.md](HAZARD-PERCEPTION.md) for the latest update. This document retains the original module curriculum/release details. Existing course definitions, versions and results are preserved.


**Released:** 6 September 2026  
**Playable modules:** Manual Handling and Working at Height.  
**Still pending:** Hazard Perception assessment and the final three-module certificate flow.

## What the module covers

This is a ground-level **planning and hazard-control simulation**, not permission to climb or operate access equipment. A fall capable of causing injury can matter even at a low level. The learning approach is **avoid height → prevent falls → minimise the remaining consequences**, with collective protection considered before personal systems.

The assigned virtual trainer introduces five checkpoints in a procedural 3D maintenance zone:

| Checkpoint | Decision being practised | Marks |
|---|---|---:|
| Avoid height first | Consider a suitable ground-level method for cleaning a non-electrical sign, after checking the task and surroundings. | 14 |
| Check access equipment | Do not use a ladder with a damaged rung; report it and follow the removal-from-service procedure. | 14 |
| Prevent a fall | Stop access to a platform with missing edge protection and arrange suitable controls and a safe work method. | 14 |
| Protect people below | Plan controls for falling objects, restrict access to the area and arrange an agreed alternative route. | 14 |
| Competence and rescue planning | Do not start untrained/unauthorised work; refer it for competent planning, equipment selection, supervision and rescue arrangements. | 14 |

The briefing and question bank also cover fragile surfaces/rooflights, risk-based ladder selection, unsafe access using ordinary pallets or storage racking, low-level falls and the limits of relying on PPE.

### What changes in the 3D scene

- The ground-level method is marked as reviewed.
- The damaged ladder is tagged **DO NOT USE** and restricted. Its damaged rung stays damaged: the scene does not demonstrate a repair.
- The missing platform rails/toe boards are illustrated, with an **inspection required** notice—not a permission to use the platform.
- Barriers and an alternative-route notice appear below the overhead work area.
- The work-plan station changes to **ON HOLD / SUPERVISOR REVIEW**, not “approved”.

After any response, the safer arrangement is shown for learning. A wrong first response still earns zero marks. There are no climbing controls, harness-fitting instructions, anchorage-design instructions or practical rescue demonstrations.

## Learner flow and controls

1. Sign in as an employee after completing any required first-password change.
2. Open **Working at Height → Start training** in the hub.
3. Read the briefing and safety limits, check the acknowledgement, and start the practical activity.
4. Drag or use arrow keys to look around. The look/zoom controls, projected markers and object clicks all work with the 3D view. **Locate / Inspect** controls provide an equivalent keyboard/no-WebGL route.
5. Complete five checkpoints in order. Each first response is saved immediately; read the trainer’s explanation before continuing.
6. Start the quiz when ready: **five questions** are drawn from a **nine-question bank**, with shuffled question/choice order and **20 seconds per question**.
7. Select an answer to submit it. A timeout earns zero, presents feedback, then continues automatically after a short reading interval. **Pause to read** pauses that between-question continuation, not an active question’s timer.
8. Review the saved score, stars and explanations. Retake if needed, or practise again while keeping the best genuine assessed score.

Quiz deadlines are server-side. Reloading, changing the client clock, switching tabs, signing out or stopping the server does not reset them. An untimed activity can be resumed later. Finish an active timed question before installing an update if you do not want it to time out during the restart.

## Scoring and data protection

- Five activity decisions × 14 = **70 marks**.
- Five quiz questions × 6 = **30 marks**.
- Pass this module at **70/100 or above**.
- Stars: 3 for 85–100, 2 for 70–84, 1 for a below-pass attempt.
- A lower-scoring retake cannot reduce an earlier genuine assessed best.
- Manual Handling and Working at Height have **separate** open attempts, histories and best scores. One module cannot overwrite the other’s result.
- Existing release-1.2 Manual Handling results and timestamps remain readable without a schema migration. The original Manual question/checkpoint IDs and grading remain unchanged.
- A demonstration score is not a genuine best. The first real assessment replaces only that module’s sample score. Installing the code does not reset any scores.
- Server-side ownership, role/readiness checks, CSRF, immutable first responses and replay protection still apply. Client-supplied totals are rejected.
- Only employees can undertake training. The admin sees their results through the existing employee/progress views. Trainers remain characters, not login accounts.
- Employee deactivation blocks access while preserving results. Confirmed employee deletion removes their attempts and progress.
- Passing these two modules does not produce a certificate. The later certificate flow must require genuine passes in all three modules, not an average or sample scores.

## Safe Windows update

Use **Zero-Incident-Working-at-Height-Update.zip** for the project you already run. This is a **frontend and backend** update and includes the earlier Manual Handling/shared UI code needed by the new module.

1. Finish any active timed question, stop the Node server with **Ctrl+C**, and back up the project—especially `.env`, `data/`, uploaded pictures and your own code changes. Use your normal database backup procedure if MongoDB is external.
2. Extract the update ZIP and open `zero-incident-working-at-height-update`.
3. Copy/merge its `public`, `server`, `tests` and `docs` folders plus `README.md`, `package.json` and `package-lock.json` into your existing inner project folder:

   ```text
   D:\Zero-Incident-Admin-Auth\zero-incident\
   ```

4. Replace matching code files. **Do not delete the project, `.env`, `data/` or existing assets.** Do not create nested `public/public` or `server/server` folders. Merge your own custom code rather than blindly overwriting it.
5. From that existing folder run:

   ```powershell
   npm install
   npm start
   ```

6. Open **http://localhost:3000**, press **Ctrl+F5**, sign in as an employee and choose **Working at Height**.

The patch excludes `.env`, runtime databases, uploads and the existing `public/assets` directory. Account credentials, employee IDs, trainer assignments/pictures and existing Manual Handling history are not replaced. No database wipe, reset or new runtime dependency is required when updating from release 1.2; `npm install` keeps the package metadata in sync.

A full source archive, **Zero-Incident-Working-at-Height-Full-Project.zip**, is also available for fresh installation/reference. Prefer the **Update** ZIP for an existing installation so you keep using the same environment and database.

### If something looks wrong

- **Working at Height still says overview:** the old server or cached frontend may still be running. Confirm both folders were merged, restart Node and press Ctrl+F5.
- **Missing module/404:** include all shared files. In particular, `learning-module.js`, `module-views.js`, `module-readings.js`, `warehouse-scene.js`, `height-scene.js`, the page wrappers, and the updated backend must be present together.
- **3D unavailable:** use a current Chrome/Edge browser with WebGL/hardware acceleration, or use the supported Inspect controls. All assessment decisions and marks are available without 3D.
- **Attempt belongs to another module:** return to the hub and open the correct module. The app intentionally refuses to display a Manual Handling attempt as a Working at Height result.
- **Lost connection:** reconnect to recover the stored state. The active quiz deadline continues on the server.

## Implementation notes

- `server/training-content.js`: both private, versioned course definitions and public reference metadata. Manual version stays `warehouse-2026-v1`; Height is `height-2026-v1`.
- `server/training.js`: shared server-side state machine; all scoring/content lookup is scoped by the stored attempt’s module key and employee owner.
- `public/js/learning-module.js`: shared briefing, activity, timer, feedback, history and result UI, with a guard against cross-module attempt URLs.
- `public/js/module-views.js` / `module-readings.js`: module-specific presentation and study guides.
- `public/js/warehouse-scene.js`: reusable camera, warehouse, object picking, markers and cleanup; user-requested focus changes respect reduced-motion preferences.
- `public/js/manual-scene.js`: original Manual props, retained through the shared renderer.
- `public/js/height-scene.js`: new Height equipment and control demonstrations.
- `public/js/manual-handling.js` / `working-at-height.js`: separate page entry points.
- `public/training.css`: shared responsive layouts with the blue Height theme and existing green Manual theme.

Endpoint families:

```text
GET  /api/training/manual-handling
GET  /api/training/working-at-height
POST /api/training/:moduleKey/start
GET  /api/training/attempts/:id
POST /api/training/attempts/:id/inspect
POST /api/training/attempts/:id/activity-answer
POST /api/training/attempts/:id/quiz/next
POST /api/training/attempts/:id/quiz/answer
```

Only the two released module keys are accepted. Correct answers are kept out of public assets and are disclosed in feedback only after the response/timeout. Retakes remain learning exercises, not proctored practical qualifications. Do not rename live question/checkpoint IDs or change scoring without a versioning/migration plan for stored attempts.

## Verification

```powershell
npm test
npm run test:manual
npm run test:height
npx playwright install chromium
npm run test:browser
npm run test:appearance
npm run test:manual:browser
npm run test:height:browser
npm audit --omit=dev
```

Tests use disposable databases, not the running project’s database. The three API suites passed (12 + 8 + 10 TAP tests including parent suites). All account, appearance, Manual and Height browser suites passed, including real 20-second timeouts, reloads, retakes, mobile layouts, no-WebGL completion and module isolation. The production dependency audit reported zero vulnerabilities at verification time.

## Safety references and remaining limits

The original scenarios draw on:

- [HSE — Introduction to working at height safely](https://www.hse.gov.uk/work-at-height/introduction.htm)
- [HSE — Selecting and using ladders](https://www.hse.gov.uk/work-at-height/ladders/when-how-to-use-ladders-safely.htm)
- [HSE — Ladder pre-use checks](https://www.hse.gov.uk/work-at-height/ladders/how-to-check-ladder-is-safe-before-use.htm)
- [HSE — Warehousing and storage: Keep it safe](https://www.hse.gov.uk/pubns/indg412.pdf)

These are general guidance sources, not a statement that UK law applies to every deployment. A competent workplace safety reviewer must adapt/approve the content against local requirements, manufacturer instructions and company risk assessments before real employee training.

This release is not practical competence certification, equipment approval or authorisation to work at height. It has not undergone a formal accessibility, penetration, real-device or production-load audit. The assessed timer is fixed at the requested 20 seconds; alternative assessment-time accommodations, certificate policy and operational/retention controls remain deployment decisions.
