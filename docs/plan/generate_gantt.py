#!/usr/bin/env python3
"""Gantt charts for the Tech-Yeti 12-week project plan.

- gantt-team.png/.svg     team-level Gantt chart (all tasks + milestones)
- gantt-safal.png/.svg    individual Gantt chart (developer: Safal Sharma)

Both are rendered with cairosvg; the same data also feeds the .docx files
(see make_docs.py).
"""
import cairosvg

# ---------------------------------------------------------------- palette
PHASES = {
    1: ("Initiation & Requirements (Weeks 1-2)", "#cfe0f7", "#2f5fa8", "#eef4fc"),
    2: ("Design & Environment (Weeks 3-5)", "#d3ecd9", "#2e7d46", "#eef8f1"),
    3: ("Sprint 1 - Authentication & Dashboard (Weeks 6-7)", "#fde6c4", "#b26a00", "#fef7ec"),
    4: ("Sprint 2 - 360 Training Core (Weeks 8-9)", "#f3d6ef", "#8e3f8e", "#fbf1fa"),
    5: ("Sprint 3 - Engagement & Safety Passport (Weeks 10-11)", "#fdf3c0", "#9a7d0a", "#fefaf0"),
    6: ("Final Delivery (Week 12)", "#f6d5d5", "#a83232", "#fdf2f2"),
}
MS_FILL = "#b23b3b"
WEEKS = list(range(1, 13))

# ---------------------------------------------------------------- data
def T(label, s, e, ph):
    return ("task", ph, label, s, e)

def M(label, week, ph):
    return ("milestone", ph, label, week, week)

def P(ph):
    return ("phase", ph, PHASES[ph][0], None, None)

TEAM_ROWS = [
    P(1),
    T("Project proposal, team roles & division of effort", 1, 2, 1),
    T("Requirements analysis & SRS draft (client brief)", 1, 3, 1),
    P(2),
    T("Confirm scope & finalize SRS", 3, 3, 2),
    T("Create shared repository", 3, 3, 2),
    T("Activity diagram, DFD & use-case review", 3, 5, 2),
    T("Development environment setup", 3, 5, 2),
    P(3),
    T("Sprint 1 backlog & RBAC policy", 6, 6, 3),
    T("Login & dashboard UI design", 6, 7, 3),
    T("Backend: auth, RBAC, account management, dashboard", 6, 7, 3),
    T("Sprint 1 deployment (Replit) & bug fixing", 7, 7, 3),
    M("Milestone: Sprint 1 client presentation & sign-off", 7, 3),
    P(4),
    T("Sprint 2 backlog", 8, 8, 4),
    T("360 scene & activity UI design", 8, 9, 4),
    T("360 scene, quiz & spot-the-hazard implementation", 8, 9, 4),
    T("Scoring, competency & attempt history", 8, 9, 4),
    T("Sprint 2 deployment (Replit) & bug fixing", 9, 9, 4),
    M("Milestone: Sprint 2 client presentation & sign-off", 9, 4),
    P(5),
    T("Sprint 3 backlog", 10, 10, 5),
    T("Leaderboard, badges & Safety Passport UI", 10, 11, 5),
    T("Leaderboard logic, retraining trigger (<70%), audit log", 10, 11, 5),
    T("Admin analytics", 10, 11, 5),
    T("Documentation compilation (test logs, reports)", 10, 11, 5),
    T("Sprint 3 deployment (Replit) & bug fixing", 11, 11, 5),
    M("Milestone: Sprint 3 client presentation & sign-off", 11, 5),
    P(6),
    T("Final consolidated deployment (Replit)", 12, 12, 6),
    T("System walkthrough & final presentation", 12, 12, 6),
    M("Milestone: project handover & assessment submissions", 12, 6),
]

SAFAL_ROWS = [
    P(1),
    T("Project kickoff, role confirmation & requirements review", 1, 2, 1),
    T("Toolchain setup (Node.js, VS Code, Replit) & 360 tech research", 1, 2, 1),
    P(2),
    T("Development environment setup (with team leader)", 3, 4, 2),
    T("Database schema design (users, modules, questions, attempts, scores, badges)", 3, 5, 2),
    T("Repository structure & API skeleton", 3, 4, 2),
    P(3),
    T("Auth API: login, RBAC policy & account management", 6, 7, 3),
    T("Dashboard API & frontend integration", 6, 7, 3),
    T("Sprint 1 Replit deployment & bug fixing", 7, 7, 3),
    M("Milestone: Sprint 1 client sign-off", 7, 3),
    P(4),
    T("360 scene integration & module engine", 8, 9, 4),
    T("Quiz & spot-the-hazard gameplay logic", 8, 9, 4),
    T("Scoring, competency & attempt history", 8, 9, 4),
    T("Sprint 2 Replit deployment & bug fixing", 9, 9, 4),
    M("Milestone: Sprint 2 client sign-off", 9, 4),
    P(5),
    T("Leaderboard, badges & Safety Passport implementation", 10, 11, 5),
    T("Retraining trigger (<70%) & audit log", 10, 11, 5),
    T("Admin analytics & Replit deployment", 10, 11, 5),
    M("Milestone: Sprint 3 client sign-off", 11, 5),
    P(6),
    T("Regression testing & final consolidated deployment", 12, 12, 6),
    T("System walkthrough, presentation & handover", 12, 12, 6),
    M("Milestone: project handover & assessment submissions", 12, 6),
]

# ---------------------------------------------------------------- renderer
LW = 350          # label column width
X0 = LW + 10      # chart left
WEEK_W = 100      # width of one week column
H1, H2 = 28, 26   # task row height, phase header row height
TOP = 130         # y of first row

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def render(title, subtitle, rows, out_svg):
    W = X0 + WEEK_W * 12 + 30
    n_task = sum(1 for r in rows if r[0] == "task" or r[0] == "milestone")
    n_ph = sum(1 for r in rows if r[0] == "phase")
    body_h = n_task * H1 + n_ph * H2
    H = TOP + body_h + 96

    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
             f'viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">')
    o.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#ffffff"/>')
    o.append(f'<text x="{W/2}" y="42" font-size="20" font-weight="700" text-anchor="middle" '
             f'fill="#111111">{esc(title)}</text>')
    o.append(f'<text x="{W/2}" y="66" font-size="12" text-anchor="middle" fill="#555555">{esc(subtitle)}</text>')

    # week header
    for i, wk in enumerate(WEEKS):
        x = X0 + i * WEEK_W
        o.append(f'<rect x="{x}" y="{TOP-30}" width="{WEEK_W}" height="26" fill="#ececec" '
                 f'stroke="#999999" stroke-width="1"/>')
        o.append(f'<text x="{x+WEEK_W/2}" y="{TOP-12}" font-size="12" font-weight="700" '
                 f'text-anchor="middle" fill="#222222">W{wk}</text>')
    o.append(f'<text x="{LW/2-10}" y="{TOP-12}" font-size="12" font-weight="700" '
             f'text-anchor="middle" fill="#222222">Task</text>')

    y = TOP
    task_idx = 0
    for r in rows:
        kind, ph, label, s, e = r
        if kind == "phase":
            _, _, _, tint = PHASES[ph]
            o.append(f'<rect x="10" y="{y}" width="{W-20}" height="{H2}" fill="{tint}" '
                     f'stroke="#bbbbbb" stroke-width="0.8"/>')
            o.append(f'<text x="22" y="{y+17}" font-size="12.5" font-weight="700" '
                     f'fill="#1a1a1a">{esc(label)}</text>')
        else:
            zebra = "#ffffff" if task_idx % 2 == 0 else "#f7f9fb"
            o.append(f'<rect x="10" y="{y}" width="{W-20}" height="{H1}" fill="{zebra}"/>')
            # label (wrap to 2 lines if long)
            tsize, tmax = 11.5, 335
            words = label.split()
            lines, cur = [], ""
            for w_ in words:
                trial = (cur + " " + w_).strip()
                if len(trial) * 6.1 > tmax and cur:
                    lines.append(cur)
                    cur = w_
                else:
                    cur = trial
            lines.append(cur)
            if len(lines) > 2:
                lines = [" ".join(lines[:-1]), lines[-1]]
            ly = y + H1/2 + 4 - (len(lines)-1)*7
            for line in lines:
                o.append(f'<text x="22" y="{ly}" font-size="{tsize}" fill="#1a1a1a">{esc(line)}</text>')
                ly += 14
            task_idx += 1

        if kind == "task":
            fill, stroke, _ = PHASES[ph][1], PHASES[ph][2], None
            bx = X0 + (s-1) * WEEK_W + 3
            bw = (e - s + 1) * WEEK_W - 6
            o.append(f'<rect x="{bx}" y="{y+6}" width="{bw}" height="{H1-12}" rx="3" '
                     f'fill="{fill}" stroke="{stroke}" stroke-width="1.4"/>')
        elif kind == "milestone":
            cx = X0 + (s-1) * WEEK_W + WEEK_W/2
            cy = y + H1/2
            o.append(f'<path d="M {cx} {cy-9} L {cx+11} {cy} L {cx} {cy+9} L {cx-11} {cy} Z" '
                     f'fill="{MS_FILL}" stroke="#7a1f1f" stroke-width="1"/>')
        if kind == "phase":
            o.append(f'<line x1="10" y1="{y+H2}" x2="{W-10}" y2="{y+H2}" stroke="#bbbbbb" stroke-width="0.8"/>')
            y += H2
        else:
            o.append(f'<line x1="10" y1="{y+H1}" x2="{W-10}" y2="{y+H1}" stroke="#dddddd" stroke-width="0.8"/>')
            y += H1

    # vertical week grid over the body
    for i in range(13):
        x = X0 + i * WEEK_W
        o.append(f'<line x1="{x}" y1="{TOP-30}" x2="{x}" y2="{TOP+body_h}" stroke="#cfcfcf" '
                 f'stroke-width="1"/>')
    o.append(f'<line x1="10" y1="{TOP-30}" x2="10" y2="{TOP+body_h}" stroke="#999999" stroke-width="1.2"/>')
    o.append(f'<line x1="{W-10}" y1="{TOP-30}" x2="{W-10}" y2="{TOP+body_h}" stroke="#999999" stroke-width="1.2"/>')
    o.append(f'<line x1="{X0}" y1="{TOP-30}" x2="{X0}" y2="{TOP+body_h}" stroke="#999999" stroke-width="1.4"/>')

    # legend
    ly = TOP + body_h + 34
    o.append(f'<text x="22" y="{ly}" font-size="12" font-weight="700" fill="#222222">Legend:</text>')
    for i, (name, fill, stroke, _) in enumerate(PHASES.values()):
        col = i % 3
        row = i // 3
        lx = 120 + col * 470
        yy = ly - 9 + row * 22
        o.append(f'<rect x="{lx}" y="{yy}" width="18" height="12" rx="2" fill="{fill}" stroke="{stroke}" '
                 f'stroke-width="1.2"/>')
        o.append(f'<text x="{lx+26}" y="{yy+10}" font-size="11" fill="#333333">{esc(name.split(" (")[0])}</text>')
    dx = 120
    dy = ly - 9 + 2*22
    o.append(f'<path d="M {dx+9} {dy} L {dx+20} {dy+6} L {dx+9} {dy+12} L {dx-2} {dy+6} Z" '
             f'fill="{MS_FILL}" stroke="#7a1f1f" stroke-width="1"/>')
    o.append(f'<text x="{dx+28}" y="{dy+10}" font-size="11" fill="#333333">Milestone (client sign-off / delivery)</text>')

    o.append('</svg>')
    svg = "\n".join(o)
    with open(out_svg, "w", encoding="utf-8") as f:
        f.write(svg)
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=out_svg.replace(".svg", ".png"), scale=1.1)
    print("wrote", out_svg, "+ .png")

render("Tech-Yeti - Team Project Plan: Gantt Chart (Weeks 1-12)",
       "12-week plan - 3 sprints + final delivery - bars = tasks, diamonds = milestones (client sign-offs)",
       TEAM_ROWS, "gantt-team.svg")
render("Safal Sharma (Developer) - Individual Project Plan: Gantt Chart (Weeks 1-12)",
       "Individual development tasks per sprint - bars = tasks, diamonds = milestones (client sign-offs)",
       SAFAL_ROWS, "gantt-safal.svg")
