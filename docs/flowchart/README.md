# Structural Flowchart — Zero Incident

Classic (structured) program flowchart of the whole system, from `START` to `END`.

- `structural-flowchart.svg` / `.png` — vector + raster versions (report-ready)
- `structural-flowchart.drawio` — editable in [diagrams.net](https://app.diagrams.net) (File → Open)
- `generate_flowchart.py` — rebuild everything after edits: `python3 generate_flowchart.py`

## Notation

| Symbol | Meaning |
| --- | --- |
| Stadium (rounded) | Start / End (terminator) |
| Rectangle | Process (computation / operation) |
| Parallelogram | Input / Output (with the user or the database) |
| Rhombus | Decision (Yes / No branches) |
| Small filled dot | Merge point (paths join) |

## The flow in plain English

1. **Start** → initialize the application (load config, connect to MongoDB, start the HTTP server) → show the login screen.
2. **Login:** enter username & password → verify against **D1 (User Accounts)**.
   - Invalid → show an error message → back to "enter username & password".
   - First login (new account) → enter a new password → update **D1**.
3. Create a secure session (cookie + CSRF token).
4. **Role split:**
   - **Administrator** → manage users (add / update / delete in D1) → sign out → END.
   - **Employee** → continue down the main path.
5. **Training hub:** load the 360° warehouse with the module overview (D2) and the employee's progress (D4) → display the hub; the trainer introduces the modules.
   - No module chosen yet → keep browsing the hub (loop).
6. **Module:** employee selects a module (door) → load content & 3D assets (D2) → deliver the 3D/360° scene (briefing + practical activity).
   - Practical not finished → keep interacting (loop).
7. **Quiz:** fetch questions & correct answers (D3) → display the knowledge check → employee submits answers → calculate the score (pass ≥ 70%) → save the attempt, update progress & scores (D4).
8. **Result:**
   - Score < 70% → show result (retake available) → *Retake now?* Yes → straight back to the quiz; No → back to the hub.
   - Score ≥ 70% → *All 3 modules passed?* No → back to the hub for the remaining modules.
9. **Completion:** generate the completion certificate (PDF), save to **D5** → display & download → destroy the session (sign out) → **END**.

The data stores **D1–D5** are the same stores as in the Data Flow Diagrams (see `docs/dfd/`).
