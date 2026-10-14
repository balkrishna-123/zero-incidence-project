> **Release 1.7 — module journey.** All three modules now share a journey flow that **supersedes** the checkpoint/activity curriculum below: a virtual-trainer introduction, then three levels of study in a rotatable **360° view** (full-screen available) with increasing depth (4 → 5 → 6 study sections), each followed by an **eight-question quiz** (twenty-four per module, 20 seconds per question — a timeout is charged like a wrong attempt). Questions must be answered correctly to continue; wrong attempts dock 25 marks (100 → 75 → 50 → 25 → 0) and can be retried. A **trainer hint** is available below the options. The **final result is the average of all nine question scores** and unlocks only after the last quiz; **70/100 passes, 85+ is Excellent**. The TILE/route/aid/move/set-down lesson content above is retained as the Level 1–3 study curriculum reference. See the README *Module journey — release 1.7 curriculum* section.

# Manual Handling — playable module, release 1.2

> **Current release: 1.5.** The verified completion and PDF certificate flow is implemented. Use [CERTIFICATES.md](CERTIFICATES.md) for the latest installation and record policy. The curriculum and original release details below are retained for reference; genuine existing results are preserved.


> **Historical release note (1.4).** All three modules are now playable; certificate generation is next. Use [HAZARD-PERCEPTION.md](HAZARD-PERCEPTION.md) for the latest update. This document retains the original module curriculum/release details. Existing course definitions, versions and results are preserved.


> **Historical release note (1.3).** Working at Height is now also playable. Use [WORKING-AT-HEIGHT.md](WORKING-AT-HEIGHT.md) for the latest update instructions. This document retains the original Manual Handling curriculum and historical release details; its question/checkpoint IDs and existing results are preserved. The controller/renderer are now shared through `learning-module.js` and `warehouse-scene.js`.

**Released:** 6 September 2026  
**Scope:** Manual Handling only. Working at Height and Hazard Perception still have their existing overviews; their assessments and the final certificate flow are not yet released.

## What belongs in Manual Handling?

Manual handling means lifting, lowering, carrying, pushing or pulling a load by hand or bodily force. This module teaches the employee to **assess and reduce risk before moving a load**, rather than assuming a lifting posture makes every task safe.

The learner is preparing a shipment of warehouse parts in a low-poly, 360-degree dispatch bay. Five checkpoints cover the practical decisions:

| Checkpoint | Content | Marks |
|---|---|---:|
| Assess the load | Consider whether the move is necessary; assess the task, individual, load and environment (TILE). Do not test an uncertain load by attempting a lift. | 14 |
| Plan the route | Identify wrapping/cartons obstructing the walkway; check the destination before moving. | 14 |
| Choose a suitable handling aid | Prefer a suitable, checked trolley where appropriate; take account of training, condition, rating and the safe system of work. | 14 |
| Move with control | For an assessed, appropriate manual move: keep the load close, stay stable and turn with the feet rather than twisting under load. | 14 |
| Set down safely | Place the item in a controlled way on the prepared surface, then adjust its position; do not obstruct a walkway. | 14 |

The briefing includes a TILE reading guide, source links and the assigned trainer’s welcome. There is **no universal safe lifting weight**. The scene is an illustration of decision-making, not a practical lifting qualification, forklift course or physics-based strength test.

## How to play

1. Sign in as an employee who has completed the required first-password change.
2. Choose **Manual Handling → Start training** in the training hub.
3. Read the briefing, check the acknowledgement and select **Start practical activity**.
4. Drag the scene to look around. You can also use the arrow keys while the canvas is focused, the look/zoom buttons, or **Locate** in the scene checkpoint list.
5. Click the highlighted numbered marker, the object itself, or an **Inspect** button. Choose the safest response. The **first response counts** and is recorded immediately.
6. Read the trainer’s explanation, then continue to the next checkpoint. The scene shows the safer arrangement after the decision; this does not retroactively change the marks for a wrong response.
7. After all five checkpoints, start the quiz when ready. There are **five questions**, drawn in shuffled order from a seven-question bank; response choices are also shuffled.
8. Select an answer to submit it immediately. Each question is worth **6 marks**, with **20 seconds** available. An unanswered timeout earns zero and advances after a short explanation. **Pause to read** stops automatic continuation between questions; it does not pause an active question.
9. Review the result, explanations, stars and activity/quiz breakdown. Use **Retake module** or **Practise again**, or return to **My progress**.

When WebGL is unavailable, the app explains the limitation and offers the same five decisions through the accessible checkpoint controls. The marking and quiz are identical; the app does not pretend a 3D view was rendered.

## Scoring and saved results

- Activity: 5 × 14 = **70 marks**.
- Quiz: 5 × 6 = **30 marks**.
- Total: **100 marks**. Pass: **70 or higher** for this module.
- Three stars: 85–100 (Excellent). Two stars: 70–84 (Pass). One star: below 70 (this attempt is below the pass mark).
- The **best genuine assessed score** is retained across retakes. A worse practice result cannot revoke an earlier passing best.
- The server stores completed attempt history, selected responses, timeout outcomes, score breakdown and the course version.
- Reloading resumes the same attempt. The question deadline is stored on the server and is not reset by reloading, switching tabs, changing the client clock or sending another “next question” request.
- Only one open Manual Handling attempt exists per employee. Replayed answer submissions cannot award additional marks or replace a first response.
- Demonstration scores are not genuine best scores. Completing the first real assessment replaces the Manual Handling sample score with its actual result; the other modules’ sample scores are not changed.
- Admin employee/progress views receive the new result automatically. Deactivation blocks training access without deleting history; confirmed employee deletion also removes that employee’s attempts.
- No certificate is issued in this release. The later certificate flow must require genuine passes in **all three** modules, not merely an average of 70 or a set of sample scores.

## Install safely on the existing Windows project

This is a **frontend AND backend update**, unlike the earlier theme-only patch.

1. Stop the running Node server with **Ctrl+C** in its VS Code terminal.
2. Back up the existing project before merging, especially `.env`, `data/` (local database and uploaded trainer pictures) and any code you edited. If using external MongoDB, use its normal backup process too.
3. Extract **Zero-Incident-Manual-Handling-Update.zip**.
4. Open the extracted `zero-incident-manual-handling-update` folder. Copy the following into the existing inner project folder:

   ```text
   D:\Zero-Incident-Admin-Auth\zero-incident\
   ```

   Copy/merge `public`, `server`, `tests`, `docs`, `package.json`, `package-lock.json` and `README.md`. Replace matching **code** files when prompted. **Do not delete or replace the entire project folder.** Do not create `public/public` or `server/server`.

5. This is the folder containing your existing `package.json`. In its terminal, run:

   ```powershell
   npm install
   npm start
   ```

6. Open **http://localhost:3000** and press **Ctrl+F5** to refresh the JavaScript/styles.
7. Use your existing employee login, then open **Manual Handling**. Do not use VS Code Live Server or double-click `index.html`.

The patch does **not** contain `.env`, runtime data, uploads or replacements for your trainer/branding assets. Installing it does not reset accounts, passwords, employee IDs, assignments or existing progress. No database wipe or replacement is required. The new attempt collection/index is created automatically.

If you customised a listed source file, merge those changes instead of blindly overwriting them. Keep the backup until you have tested the update.

The complete source archive, `Zero-Incident-Manual-Handling-Full-Project.zip`, is for a fresh installation/reference. Existing installations should use the small update archive above to avoid accidentally starting against a different `.env` or data directory.

## Troubleshooting

- **Manual still opens an old overview:** confirm both backend and frontend files were merged, restart Node and press Ctrl+F5.
- **API endpoint not found:** the old Node process may still be running, or `server/app.js` / `server/training.js` was not copied. Stop and restart from the correct inner project folder.
- **Missing JavaScript or Three.js:** keep the whole `public/vendor` folder together. `three.module.js` imports the included `three.core.min.js`; no CDN is used.
- **3D fallback appears:** use Chrome or Edge with hardware acceleration/WebGL enabled, or continue with the accessible Inspect controls. The fallback is a genuine supported activity route, not a failed login.
- **Connection lost during a question:** the server timer continues. Reconnect to recover the stored state; do not assume a reload gives more time.
- **App refuses a second attempt:** an existing open attempt is resumed intentionally. Finish it before starting another.

## Tests

Run from the project root. Each suite uses a disposable MongoDB instance and does not modify the live database.

```powershell
npm test
npm run test:manual
npx playwright install chromium
npm run test:browser
npm run test:appearance
npm run test:manual:browser
```

On Linux, Playwright may also need `npx playwright install-deps chromium`.

The Manual Handling browser suite includes a real 20-second timeout, so it takes longer than the basic account tests. It verifies rendered 3D, keyboard look-around, scene-marker inspection, saved reload, theme switching without recreating the canvas, quiz auto-next, result persistence, a lower-scoring retake retaining the best, mobile layouts, logout and a complete no-WebGL fallback attempt. Screenshots/logs are written under `data/` and are not part of the distribution.

## Implementation map

- `server/training-content.js`: fixed original lesson/scenario and private quiz bank, with references. Only Manual Handling is included in this release.
- `server/training-models.js`: attempt schema, unique open-attempt index, optimistic concurrency.
- `server/training.js`: validated inspection/response endpoints, private answer checking, server deadlines and best-result persistence.
- `server/models.js`: existing Progress summary plus genuine best-attempt reference and score breakdown.
- `public/js/manual-scene.js`: procedural Three.js warehouse, look controls, object picking, projected markers and resource disposal.
- `public/js/manual-handling.js`: briefing, activity UI, quiz, result review, resume/history and fallback controls.
- `public/training.css`: responsive light/dark module styling.
- `public/vendor/`: locally bundled Three.js 0.185.1 and its MIT licence.

The course has a fixed version (`warehouse-2026-v1`). Do not rename question/checkpoint IDs or change live scoring rules without a versioning/migration plan for stored attempts. The prototype does not yet have an admin question-bank editor or accommodation settings for alternative assessed time limits.

## Content basis and deployment limits

The scenarios are original educational examples informed by:

- [HSE — Manual handling at work](https://www.hse.gov.uk/msd/manual-handling/index.htm)
- [HSE — Good handling technique](https://www.hse.gov.uk/msd/manual-handling/good-handling-technique.htm)
- [HSE — Warehousing and storage: Keep it safe (INDG412)](https://www.hse.gov.uk/pubns/indg412.pdf)

These are general guidance sources, not a claim that UK legal requirements apply to every deployment. Adapt the content to local law, equipment, risk assessments and company procedures. A competent workplace safety reviewer should approve it before real employee training. Testing the software is **not** safety-content certification or proof of practical competence.
