#!/usr/bin/env python3
"""Generate ReadMe.pdf (Prototype Operation Guide) in the assignment's sample style:
serif document, bold numbered section headings, hairline rules, bullet/numbered lists.
Content source: /home/user/zero-incidents1/ReadMe.md (kept in sync by hand).
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, HRFlowable)

OUT = "/home/user/zero-incidents1/ReadMe.pdf"

S = dict(
    title=ParagraphStyle("title", fontName="Times-Bold", fontSize=20, leading=25, spaceAfter=10),
    sub=ParagraphStyle("sub", fontName="Times-Bold", fontSize=13, leading=17, spaceAfter=8),
    meta=ParagraphStyle("meta", fontName="Times-Roman", fontSize=10.5, leading=15),
    h=ParagraphStyle("h", fontName="Times-Bold", fontSize=13.5, leading=17,
                     spaceBefore=14, spaceAfter=8, keepWithNext=True),
    body=ParagraphStyle("body", fontName="Times-Roman", fontSize=10.5, leading=15,
                        alignment=TA_LEFT, spaceAfter=4),
    bullet=ParagraphStyle("bullet", fontName="Times-Roman", fontSize=10.5, leading=15,
                          leftIndent=14, bulletIndent=4, spaceAfter=3),
    num=ParagraphStyle("num", fontName="Times-Roman", fontSize=10.5, leading=15,
                       leftIndent=14, spaceAfter=2),
    opt=ParagraphStyle("opt", fontName="Times-Bold", fontSize=10.5, leading=15,
                       spaceBefore=8, spaceAfter=3),
    end=ParagraphStyle("end", fontName="Times-Bold", fontSize=12, leading=16,
                       spaceBefore=10, spaceAfter=2),
)

story = []
story.append(Paragraph("Zero Incident – Safety Training Simulator", S["title"]))
story.append(Paragraph("Prototype Operation Guide (README)", S["sub"]))
story.append(Paragraph("<b>Module:</b> CET257 – Enterprise Project", S["meta"]))
story.append(Paragraph("<b>Assessment:</b> Assignment 1 (A5, A6 &amp; A7)", S["meta"]))
story.append(Paragraph("<b>Team:</b> Tech-Yeti (Bipin Pija, Jiban Thapa Magar, Sushil Gaihre, Safal Sharma)", S["meta"]))
story.append(Spacer(1, 6))
story.append(HRFlowable(width="100%", thickness=0.6, color=HexColor("#999999")))

def sec(num, title):
    story.append(HRFlowable(width="100%", thickness=0.6, color=HexColor("#999999"),
                            spaceBefore=6, spaceAfter=0))
    story.append(Paragraph(f"{num}. {title}", S["h"]))

def p(text, style="body"):
    story.append(Paragraph(text, S[style]))

def b(text):
    story.append(Paragraph(text, S["bullet"], bulletText="•"))

sec(1, "Purpose of the Prototype")
p("This prototype demonstrates the <b>core interaction, usability, and engagement concepts</b> of "
  "the Zero Incident Safety Training Simulator — a 360° warehouse safety-training system.")
p("It is a <b>proof of concept</b>, not a full production deployment.")
p("Two entry points are provided: an interactive offline prototype (<i>demo.html</i>) and the fully "
  "working system (Node.js).")

sec(2, "System Requirements")
b("Desktop or laptop computer")
b("Modern web browser (Chrome, Edge, Firefox)")
b("No internet connection required for the prototype")
b("For the full system: Node.js 20 or later (no external database required)")

sec(3, "How to Launch")
p("<b>Option A — Interactive prototype (no setup)</b>", "opt")
for i, t in enumerate([
    "Open the project folder",
    "Double-click <i>demo.html</i>",
    "The prototype opens automatically in a web browser",
], 1):
    story.append(Paragraph(f"{i}.&nbsp;&nbsp;{t}", S["num"]))
p("<b>Option B — Full system</b>", "opt")
for i, t in enumerate([
    "Open PowerShell (or a terminal) in the project folder",
    "Run <i>npm install</i>",
    "Copy <i>.env.example</i> to <i>.env</i>",
    "Run <i>npm start</i>",
    "Open http://localhost:3000",
], 1):
    story.append(Paragraph(f"{i}.&nbsp;&nbsp;{t}", S["num"]))

sec(4, "Training Flow Overview")
p("The prototype walks through a complete training journey:")
for t in [
    "Login (employee and administrator roles)",
    "Walkable 3D warehouse training hub",
    "Module briefing from the 3D trainer",
    "360° practical activity (checkpoints / hazard identification)",
    "Timed knowledge quiz",
    "Scoring and pass/fail decision",
    "Retake route and completion certificate",
]:
    b(t)
p("Navigation is controlled with on-screen controls (WASD + mouse or the on-screen d-pad) and buttons.")

sec(5, "Operator Instructions")
for t in [
    "Launch <i>demo.html</i> (or the full system)",
    "Sign in as an employee (demo account <i>ramesh.s</i> / <i>Welcome!2026</i> — auto-filled in the prototype)",
    "Enter the 3D Training Hub and open a module door (Hazard Perception, Manual Handling, Working at Height)",
    "Complete the practical checkpoints in the 360° scene",
    "Answer the timed quiz questions",
    "View your score; retake the module if below 70%, or view the completion certificate",
    "Administrator (full system): manage employees, monitor progress, and review results",
]:
    b(t)

sec(6, "Scoring &amp; Feedback")
for t in [
    "Practical checkpoints and quiz questions earn marks",
    "An overall score of 70/100 is required to pass a module",
    "Instant feedback with an explanation is shown for every answer",
    "Retakes are allowed; the best assessed score is kept",
    "A completion certificate is issued for passed modules",
]:
    b(t)

sec(7, "Technical Notes")
for t in [
    "<i>demo.html</i> is built with HTML, CSS, and JavaScript — fully browser-based",
    "No server, database, or login required for the prototype",
    "Full system: Node.js and Express, MongoDB (bundled in-memory), Three.js 3D/360° engine",
    "Role-based access control (RBAC) with session and CSRF protection",
    "Certificates are generated as PDF",
    "Designed to support future VR expansion",
]:
    b(t)

sec(8, "Limitations")
for t in [
    "The 360° environment is a simulation, not full VR",
    "Limited number of scenarios",
    "Some features remain in progress (badges, advanced analytics, final module interiors)",
    "The prototype does not include persistent data storage",
]:
    b(t)
p("These limitations are expected at prototype stage.")

sec(9, "Academic Context")
p("Developed for the CET257 Enterprise Project to demonstrate:")
for t in [
    "User-centred design",
    "Interactive 3D training concepts",
    "Client-ready prototype presentation",
]:
    b(t)

story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=0.6, color=HexColor("#999999")))
story.append(Paragraph("End of ReadMe", S["end"]))
story.append(Paragraph("Thank You", S["end"]))

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=22*mm, rightMargin=22*mm,
                        topMargin=20*mm, bottomMargin=18*mm,
                        title="Zero Incident — Prototype Operation Guide (README)",
                        author="Team Tech-Yeti")
doc.build(story)
print("wrote", OUT)
