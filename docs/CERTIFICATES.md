# Final completion and certificate flow — release 1.5

**Released:** 7 September 2026  
The requested prototype flow is now implemented: secure employee onboarding → three playable modules → verified completion summary → certificate generation and PDF download.

## How employees receive the certificate

1. Complete the required first-password change and sign in again, as before.
2. Complete **Manual Handling**, **Working at Height** and **Hazard Perception**.
3. Earn at least **70/100 in each module individually**. An overall average does not compensate for a failed module.
4. Open **Certificates** in the sidebar, or use **Completion & certificate** from a module result/hub.
5. Check the final summary, name and employee identifier in the **unissued preview**.
6. Select **Generate my certificate**.
7. Select **Download PDF**. The issued record can be reopened and downloaded later.

The interface distinguishes locked, ready, issued and needs-review states. It includes current verified module totals and activity/quiz breakdowns, an overall score, links to resume/review/retake modules, and a paper-style preview.

## What actually qualifies

The certificate service does **not** trust a displayed Progress total, a `source: assessment` label or a best-attempt ID on its own. It checks the owner’s completed assessment records and recomputes their marks against the matching course version:

- The attempt belongs to the employee, is completed and is not open.
- Required checkpoints/inspections are present with unique, valid IDs.
- First response choices match the recorded correctness flags.
- The five quiz questions and responses are valid, including skip/timeout outcomes.
- Hazard Perception has all eight classifications, all five control responses and the correct one-time comparison-area deductions.
- Recorded component/total scores equal the recomputed scores.

The best **valid completed assessment** is selected separately for each module. Failed, incomplete, unknown-version or inconsistent records cannot satisfy the gate. Sample scores never qualify. If an old summary is stale but genuine complete evidence exists, the evidence can still be recognised; the summary itself is not the authority.

The course definitions and grading for the three released modules are unchanged. Existing genuine results are preserved. Learner completion panels now show verified progress; any remaining sample scores are labelled separately.

## What the PDF contains

- Zero Incident branding and **Certificate of Completion**.
- Programme: **Warehouse Safety Induction**.
- The employee’s name and employee ID (or account identifier when no employee number exists).
- All three module names and their verified scores.
- The equal-weight overall score and the requirement that every module passed.
- A unique certificate ID, programme completion date and issue date.
- Issuer: **Zero Incident**, not a fictional human signature.
- A clear statement that this records digital learning, not practical competence, a licence or authority to perform hazardous work.

The PDF is a single A4 landscape page with embedded fonts. Latin and Devanagari names, including mixed-script names, are supported. Unsupported glyphs produce a clear error before issuance rather than silently dropping part of a name. Additional scripts require a suitable licensed font and layout testing.

## Stable, immutable issued records

- One certificate record is created per employee and current programme version (`zero-incident-core-v1`).
- Concurrent/repeated generation requests return the same issued ID and dates, not duplicate certificates.
- Generation is an explicit, CSRF-protected POST. Merely opening the summary or requesting a PDF does not create a certificate.
- A reviewed recipient ID and summary key are required. If the name or selected results changed since preview, the user must refresh and review again.
- The issued name, identifier, programme, selected best marks and dates are a snapshot. Later practice can improve current progress but does **not** rewrite that historical certificate.
- The completion date is when all three modules first had verified passing attempts. The printed marks are the best verified results selected at issuance, which can be later than the first passing attempts.
- UTC instants are stored. Display dates use the timezone stored with the certificate, defaulting to **Asia/Kathmandu**. Set optional `CERTIFICATE_TIME_ZONE` to another valid IANA zone before issuing if the organisation needs it. Changing it later does not change existing certificates.

Before generating, check the name and identifier carefully. Profile changes after issuance are shown as a difference from the saved snapshot. There is no automatic correction, revocation, expiry or reissue workflow in this prototype; those require an agreed organisational policy rather than silently rewriting records.

## Record integrity and privacy

The certificate binds its selected attempts using SHA-256 digests of the immutable assessment data, and has a snapshot digest for consistency checks. On download, its stored score/owner/version bindings and linked evidence are checked again. A mismatched or missing record is marked **Needs review** and the PDF is blocked, rather than generating a replacement silently.

These checks detect inconsistent records inside the application. They are **not a public-key digital signature**, proof of a person’s practical competence, or protection against a malicious operator with unrestricted database/source access. The assessments are not proctored.

There is no public certificate lookup exposing employees’ names or results. Employees can access only their own record; administrators can view authorised completion records. Existing authentication, password readiness, active-account and CSRF checks remain in force.

## Administrator flow

1. Sign in as an administrator and open the new **Certificates** sidebar page.
2. Search by employee name, employee ID/account or certificate ID.
3. Filter issued, ready-to-generate, training-required or needs-review records.
4. Select **View record** for the current verified summary and any issued snapshot.
5. For an eligible active employee with completed password setup, review the preview and generate on their behalf if needed.
6. Download an existing verified PDF from the record page or table action.

The Employee overview dialog also links to the completion record. Certificate issuance is recorded in the existing audit history.

Deactivation blocks employee access but preserves their history/certificate for administrators. Reactivation restores access after any required password setup. Confirmed employee deletion removes the certificate along with their account, progress and attempts. Audit history is retained under the existing policy. Already downloaded offline PDF copies cannot be remotely recalled.

## Install safely on your existing Windows project

Use **Zero-Incident-Certificate-Update.zip**. It is a cumulative **frontend and backend update**, including the new PDF dependencies and bundled certificate fonts.

1. Finish any active timed question, then stop the Node server with **Ctrl+C** in VS Code.
2. Back up the project, especially `.env`, `data/`, uploaded pictures and your own code changes. Back up external MongoDB through its normal process if used.
3. Extract the ZIP and open `zero-incident-certificate-update`.
4. Copy/merge `public`, `server`, `tests` and `docs`, plus `README.md`, `package.json` and `package-lock.json`, into:

   ```text
   D:\Zero-Incident-Admin-Auth\zero-incident\
   ```

   Include **server/assets/certificate-fonts**. These are new PDF fonts, not replacements for your trainer pictures.

5. Replace matching code files. **Do not delete the existing project, `.env`, `data/` or `public/assets`.** Do not create `public/public` or `server/server`. Merge your own custom code where necessary.
6. From the existing project folder run:

   ```powershell
   npm install
   npm start
   ```

7. Open **http://localhost:3000** and press **Ctrl+F5**.
8. Use the employee **Certificates** page after genuine passes, or the administrator’s completion-records page.

**Run npm install for this update:** PDFKit and Fontkit are new runtime dependencies. No database wipe or manual data migration is required. The new certificate collection/index is created automatically.

The update archive excludes the active `.env`, runtime databases/uploads and existing branding/trainer assets. Accounts, passwords, module assignments and earlier results remain in the same database. `Zero-Incident-Complete-Project.zip` is also supplied for a fresh installation/reference; use the **Update** ZIP for an existing project.

### Troubleshooting

- **Still shows “certificate coming next”:** confirm frontend and backend were both merged; stop/restart the right Node process and press Ctrl+F5.
- **Cannot find `pdfkit` / `fontkit`:** run `npm install` in the inner project folder containing the updated package files.
- **Font file missing:** copy the complete `server/assets/certificate-fonts` directory. Keep the included OFL licence with the fonts.
- **Sample/high summary scores but certificate locked:** complete the actual assessments. Manually entered or seeded totals are not evidence.
- **Record needs review:** do not edit numbers or delete evidence to bypass the check. Investigate backups/data integrity and the linked assessment records with an authorised administrator.
- **Preview changed:** refresh and check the current recipient/results before generating.
- **Old marks or name after later changes:** this is intentional snapshot retention. The page separately shows current results and flags differences.
- **Unsupported name characters:** arrange a suitable font through the maintainer; do not alter a person’s real name just to fit a font.
- **Wrong date timezone:** configure the organisation’s intended IANA timezone before issuance; existing records retain their original setting.

## Implementation map

- `server/certificate-model.js`: unique, immutable programme certificate snapshot.
- `server/completion.js`: recomputed evidence validation, current completion state, issuance, consistency binding, ownership and admin summaries.
- `server/certificate-pdf.js`: one-page PDF with embedded Noto Sans/Devanagari fonts and plain text only.
- `server/assets/certificate-fonts/`: bundled, licensed font files.
- `public/js/certificates.js`: employee summary/preview/download and admin records/filtering/issuance.
- `public/certificates.css`: responsive light/dark completion layouts and white paper preview.
- `public/js/api.js`: authenticated binary PDF download with API error handling.
- The existing app, module result pages and employee progress views link to verified completion.

API routes (all require existing role/readiness guards):

```text
GET  /api/me/certificate
POST /api/me/certificate
GET  /api/me/certificate/pdf
GET  /api/admin/certificates
GET  /api/admin/employees/:id/certificate
POST /api/admin/employees/:id/certificate
GET  /api/admin/employees/:id/certificate/pdf
```

Issuance body: `{ recipientId, reviewKey }` from the reviewed status. Extra name/score/date/ID fields are rejected. The UI also binds downloads to the expected certificate ID.

## Verification and remaining deployment work

The certificate API tests cover authentication/ownership/readiness/CSRF, sample and forged-score rejection, the 69/70 boundary, stale previews, concurrent issuance, one-page PDFs, immutable re-downloads, later practice/profile changes, tampered evidence, admin issuance, mixed-script names, deactivation and deletion.

The browser test covers the locked → ready → issued flow, actual PDF downloads, duplicate-click protection, light/dark layouts, snapshot notices, admin search/filter/view/issue/download, and 390/320px layouts. All existing account, appearance and three-module browser/API suites were rerun successfully. Production dependency audit reported zero vulnerabilities at verification time; this is a point-in-time check, not a security guarantee.

```powershell
npm test
npm run test:manual
npm run test:height
npm run test:hazard
npm run test:certificate
npx playwright install chromium
npm run test:browser
npm run test:appearance
npm run test:manual:browser
npm run test:height:browser
npm run test:hazard:browser
npm run test:certificate:browser
npm audit --omit=dev
```

Tests use disposable databases and do not modify the running app database.

The requested **prototype** workflow is complete. Real deployment still requires competent safety-content approval, practical training arrangements, accessibility/accommodation review, production security/infrastructure and backup testing, and agreed privacy/retention, correction/revocation/expiry policies. Issuance/progress/audit operations on standalone development MongoDB are not a substitute for production transaction/reconciliation planning.
