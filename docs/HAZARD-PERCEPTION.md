> **Release 1.7 — module journey.** All three modules now share a journey flow that **supersedes** the safety-walk curriculum below: a virtual-trainer introduction, then three levels of study in a rotatable **360° view** (full-screen available) with increasing depth (4 → 5 → 6 study sections), each followed by an **eight-question quiz** (twenty-four per module, 20 seconds per question — a timeout is charged like a wrong attempt). Questions must be answered correctly to continue; wrong attempts dock 25 marks and can be retried; a **trainer hint** is available. The **final result is the average of all nine question scores** and unlocks only after the last quiz; **70/100 passes, 85+ is Excellent**. The hazard-perception lesson content below is retained as the Level 1–3 study curriculum reference. See the README *Module journey — release 1.7 curriculum* section.

# Hazard Perception — release 1.4

> **Current release: 1.5.** The verified completion and PDF certificate flow is implemented. Use [CERTIFICATES.md](CERTIFICATES.md) for the latest installation and record policy. The curriculum and original release details below are retained for reference; genuine existing results are preserved.


**Released:** 6 September 2026  
**Playable:** Manual Handling, Working at Height and Hazard Perception.  
**Next:** final certificate generation. No certificate is issued by this update.

## The new module

Hazard Perception is a **free-order, 360-degree warehouse safety walk**. Unlike the five ordered checkpoints in the first two modules, the learner reviews **eight areas in any order**. Five areas contain represented hazards; three provide clearly described comparison conditions.

The assigned trainer introduces the activity and presents system-calculated feedback. The learner stays at the observation level: the simulation does not authorise vehicle operation, electrical work, repairs or emergency intervention.

| Represented hazard | Learning decision |
|---|---|
| Contaminated walking area | Keep people away and arrange appropriate reporting/cleanup. A warning sign alone does not remove contamination. |
| Pedestrian–vehicle conflict | Stay out of the operating area and use separation or an agreed controlled crossing procedure. |
| Unstable high load | Keep clear, restrict access and obtain a trained response; do not climb, catch or push the load. |
| Damaged trailing lead | Avoid damaged parts and follow safe reporting/isolation/removal-from-use procedures with competent attention. |
| Obstructed emergency exit | Arrange safe clearance and keep the escape route available before an emergency. |

The comparison areas show an accessible safety station, a low load within a storage bay and a clear marked walkway. They are **specific illustrations**, not guarantees about real equipment or sites. Judgement should be based on conditions and possible harm, not colours alone.

## How to play

1. Sign in as an employee who has completed any required first-password change.
2. Open **Hazard Perception → Start training**.
3. Read the briefing and scoring rules, check the acknowledgement, and select **Start safety walk**.
4. Look around using drag, arrow keys or the look/zoom controls. Numbered scene markers identify inspectable areas; hovering/focusing reveals their labels. The area list also provides **Locate / Inspect** controls.
5. Inspect any area. Inspection is **free and untimed** and shows a factual observation without recording a judgement.
6. Choose **Hazard — needs action** or **No hazard shown here**. The first classification is saved immediately.
7. If the area represents a hazard, read the identification feedback and choose a safer response. A missed identification is explained so the learner can still practise selecting a control; it cannot regain the lost identification marks.
8. Review all **eight** areas and submit responses for all **five** hazards before the quiz unlocks.
9. Answer **five questions** drawn from a nine-question bank, worth six marks each. The server allows **20 seconds per question**. Select an answer to submit it immediately.
10. A timeout earns zero, shows feedback and continues automatically after a short reading interval. **Pause to read** pauses between-question continuation, not an active timer.
11. Review the total, identification/control breakdown, deductions, all eight judgements, five hazard responses and quiz explanations. Retake or practise again while keeping the genuine assessed best.

A browser without WebGL receives a clear fallback message. All eight judgements, all five responses and the identical quiz/marking remain available through the Inspect controls.

## Scoring

| Component | Maximum |
|---|---:|
| Identify five hazards correctly on the first classification: 5 × 7 | 35 |
| Choose the five correct controls on the first response: 5 × 7 | 35 |
| Five quiz answers: 5 × 6 | 30 |
| **Total** | **100** |

- Incorrectly flagging a clearly safe comparison area deducts **2 activity marks once per area** (at most six marks across three comparison areas).
- Inspecting an area, looking around or asking to view its observation does **not** deduct marks.
- A correct comparison-area judgement has no additional points; it avoids a deduction. The full activity remains capped at 70 and never falls below zero.
- Repeating or changing a submitted judgement does not change its first recorded outcome, award extra marks or apply another deduction.
- The checkpoint total combines identification and response. A displayed 14/14 is not an extra 14 marks on top of the earlier seven identification marks.
- **Pass at 70/100 or above.** Stars: three for 85–100, two for 70–84, one for a below-pass attempt.
- Missing every hazard identification cannot be rescued by only learning the control answers and a perfect quiz: 35 control + 30 quiz = 65, below the pass mark.
- A lower retake does not lower a previously earned best. A failed practice attempt is distinguished from an earlier retained pass.

**Important reporting principle:** these deductions apply only to clearly depicted comparison cases in this exercise. Real or uncertain safety concerns should always be reported or raised for advice through the site procedure. Never hide a genuine concern to protect an exercise score, and do not use simulator marks as a reason to discourage reporting.

## What the visual feedback means

- The spill is restricted and labelled for cleanup; the contamination is not claimed to have disappeared.
- Separation is illustrated around the vehicle area, with the pedestrian outside it. The vehicle is not operated by the learner.
- The unstable load remains visibly unstable behind a restriction. The learner does not repair or restack it.
- The damaged lead remains damaged, with a no-use/competent-attention tag. A tag does not confirm electrical isolation.
- Packaging is removed from the illustrated exit route to demonstrate keeping it clear.

Example controls are shown after the response for learning, including after a wrong choice. Marks remain based on the first decisions. These visual changes are not workplace approval or a substitute for an assessed safe system of work.

## Saved progress and protection of the earlier modules

- Module attempts, histories, scores and deadlines are stored on the server.
- Each employee can have one open attempt per module. Manual Handling, Working at Height and Hazard Perception remain separate.
- The original Manual and Height course definitions/versions are unchanged. Their stored results, timestamps and best-attempt references remain readable without a destructive migration.
- The new classification fields are optional additions to the attempt schema and are used for Hazard Perception only.
- Every attempt route checks the employee owner, role and password-readiness state. Mutations require CSRF tokens; the client cannot submit a total or overwrite a first outcome.
- The Hazard module is available only under its real module key. A Manual/Height attempt ID cannot be shown as a Hazard result through a changed URL.
- Deactivation blocks access while preserving history. Confirmed employee deletion removes their attempts and progress in all three modules.
- A first genuine Hazard assessment replaces only that module’s illustrative sample score. Installing this update does not reset scores.
- Quiz deadlines continue across reloads, tab switches, sign-out and server restarts. Finish an active timed question before updating if you do not want it to expire during the restart.
- All three modules must pass individually at 70 or above. An average cannot compensate for a failed module. Sample scores are not real training evidence. Certificate issuance is still the next implementation step.

## Update your existing Windows installation

Use **Zero-Incident-Hazard-Perception-Update.zip**. It includes the earlier shared module/UI code as well as the Hazard additions, but not your environment or runtime data.

1. Finish any active timed question. Stop the server with **Ctrl+C** in its VS Code terminal.
2. Back up the project, especially `.env`, `data/`, uploaded pictures and your own source-code changes. Use the normal backup process if MongoDB is hosted externally.
3. Extract the ZIP and open `zero-incident-hazard-perception-update`.
4. Copy/merge its `public`, `server`, `tests` and `docs` folders and its `README.md`, `package.json` and `package-lock.json` into the existing inner project folder:

   ```text
   D:\Zero-Incident-Admin-Auth\zero-incident\
   ```

5. Replace matching code files. **Do not delete or replace the whole project, `.env`, `data/` or your existing assets.** Do not create `public/public` or `server/server`. Merge any custom code instead of blindly overwriting it.
6. In that existing folder run:

   ```powershell
   npm install
   npm start
   ```

7. Open **http://localhost:3000**, press **Ctrl+F5**, sign in as an employee, and choose **Hazard Perception**.

No new runtime dependency or database reset is needed from release 1.3. The update ZIP excludes `.env`, runtime databases/uploads and `public/assets`, so existing credentials, images, employee IDs and module assignments are not replaced.

**Zero-Incident-Hazard-Perception-Full-Project.zip** is also provided for fresh installation/reference. Prefer the **Update** ZIP for an existing installation to keep the same environment and database.

### Troubleshooting

- **Hazard still opens an overview or says unavailable:** both frontend and backend must be merged. Restart the correct Node process and press Ctrl+F5.
- **Module import or 404 error:** include `hazard-content.js`, `hazard-walk.js`, `hazard-scene.js`, the Hazard page wrapper and the updated shared files together.
- **Cannot start the quiz:** all eight areas require a first classification and all five hazards require a response. Inspecting alone is not a completed review.
- **No classification buttons when returning to an area:** its first judgement is already recorded. Review the feedback; a changed answer cannot replace the first one.
- **A score appears lower than expected:** identification and response are separate seven-mark components. Check the false-flag deduction and the detailed review.
- **3D is unavailable:** use the supported Inspect controls, or try a current WebGL-enabled Chrome/Edge browser with hardware acceleration.
- **Connection lost:** reconnect to restore the server state. The current question’s deadline does not pause.

## Implementation and tests

- `server/hazard-content.js`: private observations, classification basis, five response tasks and nine-question bank.
- `server/training-content.js`: registers all three released courses and publishes only safe overview fields.
- `server/training-models.js`: optional classifications, selected-area state and identification correctness; existing fields/indexes are retained.
- `server/training.js`: free inspection, immutable classification, separate identification/control marks, one-time deductions and an eight-area/five-response quiz gate.
- `public/js/hazard-perception.js`: module entry point.
- `public/js/hazard-walk.js`: inspection, classification, progress and review panels.
- `public/js/hazard-scene.js`: original procedural warehouse hazard/comparison props.
- `public/js/learning-module.js`: shared saved flow, quiz/results, stale-feedback guards and Hazard-specific orchestration.
- `public/js/warehouse-scene.js`: existing shared renderer, now using time-based camera smoothing and refreshing static shadows only when scene state changes.

Course version: `hazard-2026-v1`. Do not rename live area/question/checkpoint IDs or change marking without a version/migration plan for existing attempts. There is no admin question-bank editor or alternate assessed timer setting in this prototype.

```powershell
npm test
npm run test:manual
npm run test:height
npm run test:hazard
npx playwright install chromium
npm run test:browser
npm run test:appearance
npm run test:manual:browser
npm run test:height:browser
npm run test:hazard:browser
npm audit --omit=dev
```

All test applications use disposable MongoDB instances, not the running project database. The Hazard suites cover free inspection, first-judgement immutability, replay protection, partial marks, deductions, the eight-area gate, deadlines, 70/84/85 boundaries, best-score retention, legacy preservation, role/owner checks, sample replacement, deletion, real 20-second auto-next, mobile layouts and a complete no-WebGL fallback attempt.

## Content sources and deployment limits

The original examples are informed by:

- [HSE — Warehousing and storage: Keep it safe](https://www.hse.gov.uk/pubns/indg412.pdf)
- [HSE — Separating pedestrians and vehicles](https://www.hse.gov.uk/workplacetransport/separating.htm)
- [HSE — Preventing slips and trips](https://www.hse.gov.uk/slips/preventing-overview.htm)
- [HSE — Electrical equipment maintenance](https://www.hse.gov.uk/electricity/faq-portable-appliance-testing.htm)
- [GOV.UK — Clear escape routes and evacuation plans](https://www.gov.uk/workplace-fire-safety-your-responsibilities/fire-safety-and-evacuation-plans)

These are general reference sources, not a claim that UK law applies in every location. A competent workplace safety reviewer should adapt and approve the content against local law, manufacturer instructions and company procedures before real training.

This is not practical competence certification, workplace approval, or a proctored qualification. Formal security/accessibility/real-device/load testing, appropriate assessed-time accommodations, production operations and data-retention policies still need review before deployment.
