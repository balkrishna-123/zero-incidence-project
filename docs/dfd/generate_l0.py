#!/usr/bin/env python3
"""Level 0 (context) DFD for Zero Incident, in two styles.

Level 0 = one process (the whole system) + external entities + top-level
data flows. No data stores (they are hidden inside the system and appear
from Level 1 onwards).

Outputs:
  L0.svg / L0.png            - circular style (matches L1.svg)
  L0-unified.svg / .png      - professor's band style (matches L1-unified)
  level0-dfd.drawio          - both pages, editable in diagrams.net
"""

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

SUB = "Zero Incident (Safety Training Simulator)"

# ---------------- shared content ----------------
ADMIN = "Administrator"
EMP = "Employee / Learner"
F_ADMIN_IN = "Manage users (add / update / delete)"
F_ADMIN_OUT = "User account updates & status"
F_EMP_IN_1 = "Credentials + training input"
F_EMP_IN_2 = "(selection, interaction, quiz answers)"
F_EMP_OUT_1 = "3D training, quiz, scores &"
F_EMP_OUT_2 = "certificate (PDF)"

# ---------------- circular style (L0.svg) ----------------
W0, H0 = 960, 600
CX, CY, R = 500, 330, 105

def halo(o, x, y, label, size=9.5, anchor="middle", fill="#222222"):
    for j, line in enumerate(label.split("\n")):
        yy = y + j * 13
        o.append(f'<text x="{x}" y="{yy}" font-size="{size}" fill="none" '
                 f'stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round" '
                 f'text-anchor="{anchor}">{esc(line)}</text>')
        o.append(f'<text x="{x}" y="{yy}" font-size="{size}" fill="{fill}" '
                 f'text-anchor="{anchor}">{esc(line)}</text>')

def arrow(o, p1, p2, dashed=False):
    dash = ' stroke-dasharray="7 5"' if dashed else ""
    o.append(f'<line x1="{p1[0]}" y1="{p1[1]}" x2="{p2[0]}" y2="{p2[1]}" '
             f'stroke="#222222" stroke-width="1.5"{dash} marker-end="url(#ah)"/>')

def build_l0_svg():
    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W0}" height="{H0}" '
             f'viewBox="0 0 {W0} {H0}" font-family="Helvetica, Arial, sans-serif">')
    o.append('<defs><marker id="ah" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">'
             '<path d="M0,0 L9,4 L0,8 Z" fill="#222222"/></marker></defs>')
    o.append(f'<rect x="0" y="0" width="{W0}" height="{H0}" fill="#ffffff"/>')
    o.append(f'<text x="{W0/2}" y="40" font-size="17" font-weight="700" text-anchor="middle" '
             f'fill="#111111">Level 0 DFD \u2014 Zero Incident (Context Diagram)</text>')
    o.append(f'<text x="{W0/2}" y="62" font-size="11.5" text-anchor="middle" fill="#555555">{SUB}  \u00b7  '
             f'the whole system as ONE process \u00b7 data stores are hidden inside (they appear from Level 1)</text>')

    # entities
    o.append('<rect x="100" y="150" width="190" height="60" rx="4" fill="#ffffff" stroke="#111111" stroke-width="1.5"/>')
    o.append(f'<text x="195" y="185" font-size="12.5" font-weight="700" text-anchor="middle" fill="#111111">{ADMIN}</text>')
    o.append('<rect x="100" y="430" width="190" height="60" rx="4" fill="#ffffff" stroke="#111111" stroke-width="1.5"/>')
    o.append(f'<text x="195" y="465" font-size="12.5" font-weight="700" text-anchor="middle" fill="#111111">{EMP}</text>')

    # circle
    o.append(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="#ffffff" stroke="#111111" stroke-width="1.8"/>')
    o.append(f'<text x="{CX}" y="298" font-size="15" font-weight="700" text-anchor="middle" fill="#111111">0</text>')
    for j, line in enumerate(["Zero Incident", "Safety Training", "Simulator"]):
        o.append(f'<text x="{CX}" y="{322+j*22}" font-size="14" font-weight="700" text-anchor="middle" '
                 f'fill="#111111">{esc(line)}</text>')

    # arrows (pairs: in from entity, out to entity) - labels anchored in clear zones
    arrow(o, (290, 175), (416, 268))
    halo(o, 297, 168, "Manage users (add / update / delete)", anchor="start")
    arrow(o, (410, 276), (290, 205))
    halo(o, 297, 284, "User account results", anchor="start")

    arrow(o, (290, 445), (408, 380))
    halo(o, 330, 398, "Credentials + training input")
    halo(o, 330, 411, "(selection, quiz answers)")
    arrow(o, (414, 390), (290, 475))
    halo(o, 358, 456, "3D training, quiz, scores &")
    halo(o, 358, 469, "certificate (PDF)")

    o.append(f'<text x="{W0/2}" y="{H0-22}" font-size="11" text-anchor="middle" fill="#555555">'
             f'Legend:  rectangle = external entity \u00b7 circle = process (the whole system) \u00b7 '
             f'every arrow is a named data flow \u00b7 no data stores at Level 0</text>')
    o.append('</svg>')
    return "\n".join(o)

# ---------------- unified style (L0-unified.svg) ----------------
W1, H1 = 1160, 460
PUX, PUW, PUH, PUT = 500, 200, 210, 130   # process box
EUX, EUW, EUH = 150, 150, 44              # entities

def build_l1u_svg():
    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W1}" height="{H1}" '
             f'viewBox="0 0 {W1} {H1}" font-family="Helvetica, Arial, sans-serif">')
    o.append('<defs><marker id="ah" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">'
             '<path d="M0,0 L9,4 L0,8 Z" fill="#222222"/></marker></defs>')
    o.append(f'<rect x="0" y="0" width="{W1}" height="{H1}" fill="#ffffff"/>')
    o.append(f'<text x="{W1/2}" y="48" font-size="19" font-weight="700" text-anchor="middle" '
             f'fill="#111111" letter-spacing="1">ZERO INCIDENT - LEVEL 0 DATA FLOW DIAGRAM</text>')

    # process box
    o.append(f'<rect x="{PUX}" y="{PUT}" width="{PUW}" height="{PUH}" rx="12" fill="#ffffff" '
             f'stroke="#111111" stroke-width="1.7"/>')
    o.append(f'<line x1="{PUX}" y1="{PUT+30}" x2="{PUX+PUW}" y2="{PUT+30}" stroke="#111111" stroke-width="1.3"/>')
    o.append(f'<text x="{PUX+PUW/2}" y="{PUT+21}" font-size="12.5" font-weight="700" '
             f'text-anchor="middle" fill="#111111">0</text>')
    for j, line in enumerate(["Zero Incident", "Safety Training", "Simulator"]):
        o.append(f'<text x="{PUX+PUW/2}" y="{PUT+85+j*22}" font-size="13.5" font-weight="700" '
                 f'text-anchor="middle" fill="#111111">{esc(line)}</text>')

    # entities + arrow pairs
    ents = [(ADMIN, 160, (F_ADMIN_IN, F_ADMIN_OUT)),
            (EMP, 258, (F_EMP_IN_1 + "\n" + F_EMP_IN_2, F_EMP_OUT_1 + "\n" + F_EMP_OUT_2))]
    for k, (ename, ey, (lin, lout)) in enumerate(ents):
        cy = ey + EUH / 2
        o.append(f'<rect x="{EUX}" y="{ey}" width="{EUW}" height="{EUH}" rx="4" fill="#ffffff" '
                 f'stroke="#111111" stroke-width="1.5"/>')
        o.append(f'<text x="{EUX+EUW/2}" y="{cy+4}" font-size="12" font-weight="700" '
                 f'text-anchor="middle" fill="#111111">{esc(ename)}</text>')
        ai, ao = cy - 9, cy + 9
        o.append(f'<line x1="{EUX+EUW}" y1="{ai}" x2="{PUX-2}" y2="{ai}" stroke="#222222" '
                 f'stroke-width="1.5" marker-end="url(#ah)"/>')
        ni = lin.count("\n") + 1
        halo(o, (EUX+EUW+PUX)/2, ai - 8 - 13 * (ni - 1), lin)
        o.append(f'<line x1="{PUX}" y1="{ao}" x2="{EUX+EUW+2}" y2="{ao}" stroke="#222222" '
                 f'stroke-width="1.5" marker-end="url(#ah)"/>')
        halo(o, (EUX+EUW+PUX)/2, ao + 3, lout)

    o.append(f'<text x="{W1/2}" y="{H1-22}" font-size="11" text-anchor="middle" fill="#555555">'
             f'Legend:  rectangle = external entity \u00b7 rounded box = process (the whole system) \u00b7 '
             f'a context diagram has NO data stores \u2014 D1\u2013D5 appear from Level 1</text>')
    o.append('</svg>')
    return "\n".join(o)

# ---------------- draw.io (2 pages) ----------------
def esc_dio(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "&#10;")

def page_circle():
    cells = ['<mxCell id="0"/><mxCell id="1" parent="0"/>']
    def cell(cid, value, style, x, y, w, h):
        cells.append(f'<mxCell id="{cid}" value="{esc_dio(value)}" style="{style}" '
                     f'vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" '
                     f'height="{h}" as="geometry"/></mxCell>')
    def edge(label, p1, p2, dashed=False):
        cells.append(f'<mxCell id="e{len(cells)}" value="{esc_dio(label)}" '
                     f'style="html=1;strokeWidth=1.6;endArrow=block;endFill=1;startArrow=none;'
                     f'fontSize=10;{"dashed=1;dashPattern=8 4;" if dashed else ""}" '
                     f'edge="1" parent="1"><mxGeometry relative="1" as="geometry">'
                     f'<mxPoint x="{p1[0]}" y="{p1[1]}" as="sourcePoint"/>'
                     f'<mxPoint x="{p2[0]}" y="{p2[1]}" as="targetPoint"/></mxGeometry></mxCell>')

    cell("t", "Level 0 DFD — Zero Incident (Context Diagram)",
         "text;html=1;align=center;fontSize=17;fontStyle=1;", 100, 18, 760, 26)
    cell("c", "0\n\nZero Incident\nSafety Training\nSimulator",
         "ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#111111;strokeWidth=1.8;"
         "fontSize=14;fontStyle=1;", CX-R, CY-R, 2*R, 2*R)
    cell("a", ADMIN, "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#111111;"
                     "strokeWidth=1.5;fontSize=12.5;fontStyle=1;", 100, 150, 190, 60)
    cell("e", EMP, "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#111111;"
                   "strokeWidth=1.5;fontSize=12.5;fontStyle=1;", 100, 430, 190, 60)
    edge("Manage users (add / update / delete)", (290, 175), (416, 268))
    edge("User account results", (410, 276), (290, 205))
    edge("Credentials + training input\n(selection, quiz answers)", (290, 445), (408, 380))
    edge("3D training, quiz, scores &\ncertificate (PDF)", (414, 390), (290, 475))
    return ("\n".join(cells), W0, H0)

def page_unified():
    cells = ['<mxCell id="0"/><mxCell id="1" parent="0"/>']
    def cell(cid, value, style, x, y, w, h):
        cells.append(f'<mxCell id="{cid}" value="{esc_dio(value)}" style="{style}" '
                     f'vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" '
                     f'height="{h}" as="geometry"/></mxCell>')
    def edge(label, p1, p2):
        cells.append(f'<mxCell id="e{len(cells)}" value="{esc_dio(label)}" '
                     f'style="html=1;strokeWidth=1.6;endArrow=block;endFill=1;startArrow=none;'
                     f'fontSize=10;" edge="1" parent="1"><mxGeometry relative="1" as="geometry">'
                     f'<mxPoint x="{p1[0]}" y="{p1[1]}" as="sourcePoint"/>'
                     f'<mxPoint x="{p2[0]}" y="{p2[1]}" as="targetPoint"/></mxGeometry></mxCell>')

    cell("t", "ZERO INCIDENT - LEVEL 0 DATA FLOW DIAGRAM",
         "text;html=1;align=center;fontSize=19;fontStyle=1;", 20, 24, W1-40, 30)
    cell("p", "Zero Incident\nSafety Training\nSimulator",
         "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#111111;strokeWidth=1.7;"
         "fontSize=13;fontStyle=1;verticalAlign=middle;", PUX, PUT, PUW, PUH)
    cell("pl", "", "endArrow=none;html=1;strokeWidth=1.3;fillColor=none;", PUX, PUT+30, PUW, 1)
    cell("pn", "0", "text;html=1;align=center;fontSize=12;fontStyle=1;", PUX, PUT+3, PUW, 22)
    ents = [(ADMIN, 160), (EMP, 258)]
    for k, (ename, ey) in enumerate(ents):
        cell(f"ent{k}", ename,
             "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#111111;strokeWidth=1.5;"
             "fontSize=12;fontStyle=1;", EUX, ey, EUW, EUH)
        cy = ey + EUH / 2
        if ename == ADMIN:
            edge(F_ADMIN_IN, (EUX+EUW, cy-9), (PUX, cy-9))
            edge(F_ADMIN_OUT, (PUX, cy+9), (EUX+EUW, cy+9))
        else:
            edge(F_EMP_IN_1 + "\n" + F_EMP_IN_2, (EUX+EUW, cy-9), (PUX, cy-9))
            edge(F_EMP_OUT_1 + "\n" + F_EMP_OUT_2, (PUX, cy+9), (EUX+EUW, cy+9))
    return ("\n".join(cells), W1, H1)

def wrap_page(pid, name, inner, w, h):
    return ('  <diagram id="' + pid + '" name="' + name + '">\n    <mxGraphModel '
            f'dx="{w}" dy="{h}" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" '
            f'arrows="1" fold="0" page="1" pageScale="1" pageWidth="{w}" pageHeight="{h}" '
            'math="0" shadow="0">\n      <root>\n' + inner + '\n      </root>\n    </mxGraphModel>\n  </diagram>\n')

c1, w1, h1 = page_circle()
c2, w2, h2 = page_unified()
doc = ('<mxfile host="app.diagrams.net" agent="zero-incident-dfd" version="24.7.7">\n'
       + wrap_page("l0circle", "Level 0 (Circle)", c1, w1, h1)
       + wrap_page("l0unified", "Level 0 (Unified Style)", c2, w2, h2)
       + '</mxfile>\n')
with open("level0-dfd.drawio", "w", encoding="utf-8") as f:
    f.write(doc)

with open("L0.svg", "w", encoding="utf-8") as f:
    f.write(build_l0_svg())
with open("L0-unified.svg", "w", encoding="utf-8") as f:
    f.write(build_l1u_svg())
print("wrote L0.svg, L0-unified.svg, level0-dfd.drawio")
