# Trainer profile picture fix — October 2026

## Reproduced cause

The full create-trainer form submits six profile fields, three credential fields, two raw permission-checkbox fields, one JSON permissions field and one JSON moduleKeys field: **13 text fields** with both permissions enabled. Multer previously capped multipart fields at **12**, producing `LIMIT_FIELD_COUNT`. Its error handler mapped every non-size upload error to “Invalid image upload. Choose one JPG, PNG or WebP.” That message incorrectly blamed a valid image.

The previous integration helper submitted only nine fields, so it did not catch this browser-form regression. The helper now submits the full 13-field form, and the valid PNG test was reproduced failing before the fix and passing afterward. This is a confirmed code-level cause matching the screenshot's error; no production logs or original landscape image were supplied.

## Changes

- Trainer creation accepts requests without an image; other required identity and credential fields are unchanged.
- The frontend marks Profile picture **optional** and removes the required-image submission check.
- Removed duplicate `permission-view` and `permission-reset` fields from the submitted FormData; permission state is still sent as the existing JSON object.
- Raised the server's multipart field cap to 20, retaining a bounded request and backward compatibility with the 13-field form.
- Multer errors now report the actual field/file problem and include the error code.
- No-photo trainers use `/images/trainer-default.svg`, a bundled default safety-guide avatar, in admin cards, module overview and learning-course payloads. No external image service is used.
- Added Clear selection to cancel a newly selected picture and save without it. On editing, Clear selection cancels the replacement, not the existing stored picture.
- Editing without a replacement retains the existing picture.
- Still-image checks, JPG/PNG/WebP content decoding, 5 MB and 20 MP limits, metadata stripping, WebP conversion and authenticated access to uploaded pictures remain in place. Invalid images are not silently discarded.

## Verification

- `npm test`: **23 tests passed**.
- `node tests/browser-trainer-upload.mjs`: no-image creation with both permissions, rendered default avatar, valid PNG with both permissions, clear-selection save and zero page errors passed.
- Integration checks include valid PNG with all 13 legacy fields, JPEG/WebP replacement uploads, no-image edits retaining existing pictures, default avatar in employee hub and course data, accurate field-limit messages, and continued rejection of corrupt and oversized uploads.

## Apply the updated cumulative ZIP

Back up the repository and local work. Copy the contents of the ZIP's `zero-incidence-updated-revisions/` directory over your project root, preserving the folder structure. This cumulative revision archive supersedes the earlier October revision ZIP and includes all five earlier changes plus this trainer-image fix. It contains changed files only, not a full standalone project.

Run `npm install` if needed, restart the server, and refresh the browser. No new dependencies or database migration are required. Existing uploaded pictures and trainer records are retained; existing empty-picture records now receive the avatar fallback automatically.
