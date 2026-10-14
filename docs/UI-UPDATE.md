# Light theme + visible sign-out — UI update 1.1

## What changed

- **Sign out** is now a labelled button at the **top right** of every admin and employee page.
- The top bar stays visible when the page scrolls.
- The sidebar profile/sign-out control is fixed at its bottom. Navigation scrolls separately on shorter screens, so it cannot push the exit off screen.
- **Light mode / Dark mode** can be switched from the top bar. On small phones, this is a sun/moon icon beside Sign out.
- Admin and employee workspaces remember their appearance separately in this browser. The choice survives reloads and sign-ins and updates other open tabs.
- Changing theme does not rerender the page, clear a partially completed form or reset the scroll position.
- The login and first-password pages keep their original light design.
- The hidden mobile sidebar is inert until opened; Escape closes it.
- Fixed visually hidden autofill/table-label elements causing unwanted horizontal page scrolling.
- Sign-out still destroys the server-side session. It also retries once with a fresh CSRF token when another tab has rotated an older token.

## Install the small update on your Windows PC

This update is **not a separate app**. Apply it to the existing project you already installed.

1. In the VS Code terminal running `npm start`, press **Ctrl+C** to stop the server.
2. Back up any custom changes you made to the files listed below.
3. Extract `Zero-Incident-UI-Update.zip`.
4. Inside the extracted `zero-incident-ui-update` folder, copy its **public** folder into your existing inner project folder:

   ```text
   D:\Zero-Incident-Admin-Auth\zero-incident\
   ```

   This is the folder containing `package.json`, `server`, and your existing `public` folder.

5. **Merge** the folders and replace matching files. Do not delete your existing `public` folder, and do not put the new `public` inside `public`.
6. Your files should now include:

   ```text
   zero-incident/
   ├── package.json                 (unchanged)
   ├── .env                         (keep yours)
   ├── data/                        (keep all your data)
   └── public/
       ├── styles.css               (replaced)
       └── js/
           ├── app.js               (replaced)
           ├── icons.js             (replaced)
           └── theme.js             (new)
   ```

7. Start the server again, from the existing project folder:

   ```powershell
   npm start
   ```

8. Open **http://localhost:3000** and press **Ctrl+F5** to reload the updated JavaScript and stylesheet.
9. Sign in with your existing credentials. Use **Light mode** at the top right, or **Sign out** beside it.

**You do not need to run `npm install` again for this update.** There are no new runtime dependencies and no database migration.

The update ZIP contains **only the four frontend files and these instructions**. It does not include or replace your `.env`, database, sessions, employee accounts, scores, uploaded trainer pictures, module assignments, or static assets. Passwords you already changed stay changed.

If you made your own changes in `public/js/app.js`, `public/js/icons.js` or `public/styles.css`, merge those changes instead of blindly overwriting them.

## If the new buttons do not appear

- Confirm the file is `zero-incident/public/js/theme.js`, not `zero-incident/public/public/js/theme.js`.
- Make sure all four files above were copied. `app.js` imports the new `theme.js` module.
- Press Ctrl+F5, or close/reopen the application tab to remove an old cached script.
- Check the browser console for a missing `theme.js` (404) and verify its location.
- Keep using the Node server at port 3000, not VS Code Live Server.

## Preference storage

Only an appearance value (`light` or `dark`) is saved in browser local storage under `zero-incident.appearance.admin` or `zero-incident.appearance.employee`. Passwords and login sessions are **not** stored there. If browser storage is blocked, switching still works for the current visit; persistence after reload is unavailable.

## Verification

Automated Chromium checks cover:
- Both logout controls fully visible at 1280 × 590, matching the short-laptop scenario.
- Sticky header while scrolling a long registration form.
- Theme switching without losing input or scroll position.
- Light theme on admin pages and dialogs; dark theme on employee pages and dialogs.
- Persistence after reload/sign-in, separate role preferences, and cross-tab updates.
- Actual server-session destruction, blocked protected APIs after logout, and duplicate-click protection.
- Safe logout after a stale CSRF token is refreshed.
- 390 × 590, 320 × 480 and 844 × 360 layouts, with reachable controls and no horizontal page overflow.
- Graceful operation when local storage is unavailable.

The original browser smoke tests and API integration tests were also rerun successfully. Full real-device/browser/accessibility certification is not implied.
