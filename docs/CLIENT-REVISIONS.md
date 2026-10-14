# Client revisions — October 2026

Five changes requested by the client, implemented end to end (server, employee
dashboard, trainer dashboard, admin console, games) and covered by tests.

## 1 · Star-rating feature removed; promotions keep objective conditions

**What was removed**

- Employee sidebar entry **Rate trainer**, the `#/employee/rate-trainer` page
  and the "Rate your guides" panel on *My progress*.
- Trainer "Trainer rating" stats, "Recent ratings" and the star-based
  eligibility counter; `#/trainer/ratings` now redirects to the new
  `#/trainer/promotion` page.
- Server: `POST /api/ratings`, the `Rating` model, `ratingStats()`, and every
  rating payload in `/me/training`, `/trainer/me`, `/admin/trainers` and
  `/admin/applications`. Star CSS (`.star-input`, `.rating-row`, …) deleted.

**What replaced it**

- *Employee → trainer* is unchanged: 90/100 or higher in every module, then
  the administrator approves (`PROMOTION.trainerMinScorePerModule`).
- *Trainer → administrator* now requires **both**:
  1. `PROMOTION.adminMinDaysActive` (default **90**) days as an active trainer,
  2. `PROMOTION.adminMinCertifiedEmployees` (default **5**) employees certified
     under their guidance — an employee counts once they pass all three
     modules, at least one of which the trainer guides.
  Both numbers live in `server/config.js` and can be overridden with
  `PROMOTION_ADMIN_MIN_DAYS` / `PROMOTION_ADMIN_MIN_CERTIFIED`.
  The trainer **Promotion** page shows live progress bars for both conditions;
  the admin Applications table shows a *Requirements* column
  (`x/5 certified · y/90 days`) and approval re-checks the rule server-side.
- **Report a trainer** survived the cut: it moved into *Help & resources*
  (employee sidebar / top-bar help button). The admin report inbox is unchanged.

## 2 · Completion percentage at the top of every module

- `server/progress-percent.js` derives the percentage from immutable attempt
  bookkeeping: 1 introduction unit + 1 study unit per level + 1 unit per
  question (answered correctly) + 1 completion unit. A passed module always
  reports 100; an open attempt never reports 100 before the final phase.
- The module page shows a **Module completion** bar directly under the module
  heading; it updates live after every study/quiz action (`safeAttempt.percent`).
- Employee *My progress* shows a percent + mini bar per module, and the 3D hub
  door plates show "`x% complete`".

## 3 · Trainer and admin both see the percentages

- `GET /trainer/employees`, `GET /admin/employees`, `GET /admin/progress`,
  `GET /admin/overview` and `GET /admin/employees/:id` now return
  `modulePercents` + `overallPercent` per employee (two queries per roster,
  grouped in memory).
- Trainer roster: per-module "`x% done`" under each score plus a **Completed**
  column with a bar. Admin *Learning progress*: same columns; the employee
  detail modal and the CSV export include the percentages too.

## 4 · Forklift: pallets 2 and 3 after pallet 1

- Verified with a scripted headless playthrough
  (`node scripts/playtest-forklift.mjs`, needs a static server on `public/`):
  the 1 → 2 → 3 sequence delivers correctly in the current code, with no
  console errors. The reported block matched an older deployed build.
- Hardened anyway, so the shift can never stall or look locked:
  - `syncActive()` self-heals the active delivery index if it ever points at
    an already-delivered pallet.
  - Manifest rows are now buttons with explicit states
    **LOCKED / UP NEXT / ON BOARD / DELIVERED**; clicking a locked row explains
    "Pallet 0X unlocks as soon as Pallet 0Y is delivered — the manifest runs in
    order", clicking the active row pulses the marker and repeats the current
    instruction.
  - After each delivery the toast says which pallet just unlocked.

## 5 · Spot the Hazard converted from 2D to 3D

- New `public/js/hazard-hunt-3d.js`: a first-person Three.js aisle walk using
  the vendored `three.module.js` (no CDN, no downloads). Drag to look, walk
  with W A S D / arrows or the touch pad, click hazards with the pointer
  (raycast). Same rules as the 2D walk: 60 s, six hazards from a pool of eight,
  +100 per find, −10 per wrong click, same debrief text, same best-score key.
- All eight hazards are procedural 3D props (spill + knocked sign, blocked
  exit, overhanging carton, cable across the lane, parked forklift, worker
  without a hard hat, covered extinguisher, bent rack upright) placed on
  type-appropriate slots each walk.
- Browsers without WebGL fall back to the original 2D aisle automatically.
- Playtest hook: `window.__hh3d` (state, camera, `project(i)`), used by
  `node tests/browser-revisions.mjs`.

## Verification

- `npm test` — 21/21 (integration, promotion with the new rules, percent math).
- `node tests/browser-smoke.mjs` — full journey regression, green.
- `node tests/browser-revisions.mjs [baseUrl]` — 16 checks across employee,
  trainer and admin dashboards plus the 3D hazard walk, green.
- `node scripts/playtest-forklift.mjs [baseUrl]` — forklift 1→2→3 playthrough
  plus manifest-state assertions, green.
