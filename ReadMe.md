# Zero Incident – Safety Training Simulator

**Prototype Operation Guide (README)**

**Module:** CET257 – Enterprise Project
**Team:** Tech-Yeti (Bipin Pija, Jiban Thapa Magar, Sushil Gaihre, Safal Sharma)

---

## 1. Purpose of the Prototype

This prototype demonstrates the core interaction, usability, and engagement concepts of the Zero Incident Safety Training Simulator — a 360° warehouse safety-training system.

It is a proof of concept, not a full production deployment.

Two entry points are provided: an interactive offline prototype (`demo.html`) and the fully working system (Node.js).

## 2. System Requirements

- Desktop or laptop computer
- Modern web browser (Chrome, Edge, Firefox)
- No internet connection required for the prototype
- For the full system: Node.js 20 or later (no external database required)

## 3. How to Launch

**Option A — Interactive prototype (no setup)**

1. Open the project folder
2. Double-click `demo.html`
3. The prototype opens automatically in a web browser

**Option B — Full system**

1. Open PowerShell (or a terminal) in the project folder
2. Run `npm install`
3. Copy `.env.example` to `.env`
4. Run `npm start`
5. Open http://localhost:3000

**Demo accounts (full system)**

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `safety.admin` | `ZeroIncident!2026` |
| Trainer (Yeti) | `yeti` | `Welcome!2026` |
| Employee (Ramesh) | `ramesh.s` | `Welcome!2026` |

- The sign-in page has small **Admin console**, **Trainer workspace** and **New employee** buttons that fill in these details for you — they do not bypass authentication.
- The first sign-in as `ramesh.s` in the full system asks you to set a new password (first-login flow).
- These are published demonstration credentials: do not enter real personal data or reuse a real password.

## 4. Training Flow Overview

The prototype walks through a complete training journey:

- Login (three roles: employee, trainer and administrator)
- Walkable 3D warehouse training hub
- Module briefing from the 3D trainer
- 360° practical activity (checkpoints / hazard identification)
- Timed knowledge quiz
- Scoring and pass/fail decision
- Retake route and completion certificate

Navigation is controlled with on-screen controls (WASD + mouse or the on-screen d-pad) and buttons.

## 5. Operator Instructions

- Launch `demo.html` (or the full system)
- **Employee:** sign in with the demo account (`ramesh.s` / `Welcome!2026` — auto-filled in the prototype); set a new password if asked on first login
- Enter the 3D Training Hub and open a module door (Hazard Perception, Manual Handling, Working at Height)
- Complete the practical checkpoints in the 360° scene
- Answer the timed quiz questions
- View your score; retake the module if below 70%, or view the completion certificate
- **Trainer (yeti / Welcome!2026):** open the Trainer workspace — view employee progress, reset employee passwords, and review ratings and reports
- **Administrator (safety.admin / ZeroIncident!2026):** add, update and delete users (including trainers), monitor progress and results, and review reports and role applications

## 6. Scoring & Feedback

- Practical checkpoints and quiz questions earn marks
- An overall score of 70/100 is required to pass a module
- Instant feedback with an explanation is shown for every answer
- Retakes are allowed; the best assessed score is kept
- A completion certificate is issued for passed modules

## 7. Technical Notes

- `demo.html` is built with HTML, CSS, and JavaScript — fully browser-based, with no server or database required (its sign-in screen is pre-filled with the demo employee account)
- Full system: Node.js and Express, MongoDB (bundled in-memory), Three.js 3D/360° engine
- Role-based access control (RBAC) for the three roles, with session and CSRF protection
- Passwords are stored as salted scrypt hashes — never in plain text
- Certificates are generated as PDF

## 8. Limitations

- The 360° environment is a simulation, not full VR
- Limited number of scenarios
- Some features remain in progress (badges, advanced analytics, final module interiors)
- The prototype does not include persistent data storage

## 9. Academic Context

Developed for the CET257 Enterprise Project to demonstrate:

- User-centred design
- Interactive 3D training concepts
- Client-ready prototype presentation

---

**End of ReadMe**

**Thank You**
