# Final certificate update — release 1.5

The requested prototype workflow is now complete: secure login → all three safety modules → verified completion → certificate PDF.

This update changes BOTH frontend and backend and adds PDF dependencies/fonts.

1. Finish any active timed question. Stop your Node server with **Ctrl+C**.
2. Back up the project, especially `.env`, `data/`, uploaded pictures and any custom source code. Do not delete them.
3. Merge the extracted `public`, `server`, `tests` and `docs` folders plus `README.md`, `package.json` and `package-lock.json` into your existing folder:

   ```text
   D:\Zero-Incident-Admin-Auth\zero-incident\
   ```

   Include `server/assets/certificate-fonts`. Replace matching code files, but do not replace the whole project, `.env`, `data/` or your existing `public/assets` folder. Do not create `public/public` or `server/server`. Merge your own custom edits as needed.

4. In that existing folder run:

   ```powershell
   npm install
   npm start
   ```

   **npm install is needed:** this release adds PDFKit and Fontkit.

5. Open **http://localhost:3000**, press **Ctrl+F5**, and sign in.
6. After genuine passes of at least 70/100 in all three modules, open **Certificates**, review the recipient/results, choose **Generate my certificate**, then **Download PDF**.

Admins have a new Certificates page for viewing, issuing and downloading authorised completion records. Sample scores do not unlock issuance. Repeated generation returns the same saved certificate; later name/score changes do not rewrite it.

The patch excludes active environment files, runtime data, uploads and existing branding/trainer assets. No database reset is needed; existing accounts and genuine results are retained.

See [docs/CERTIFICATES.md](docs/CERTIFICATES.md) for evidence checks, snapshot policy, dates/fonts, troubleshooting and tests. The certificate records digital learning; it is not a licence or permission to perform hazardous work.
