# Legacy pre-journey browser tests

These Playwright scripts exercised the **pre-1.6 module UI** (checkpoint /
safety-walk activities). That UI was replaced by the module journey
(welcome → introduction → 360° study levels → eight-question quizzes), so the
flows these scripts drive no longer exist in the frontend.

They are kept for reference only and are not part of the test suite (no
`npm` script points at them). Current coverage of the same behaviours:

- `npm test` + `npm run test:manual` / `test:height` / `test:hazard` —
  server/API behaviour for each module (journey scoring, attempts, retakes).
- `npm run test:journey:browser` — browser regression for the journey quiz
  (render, hint, feedback, reload-safety).
- `npm run test:certificate:browser` — certificate flow in the browser.
