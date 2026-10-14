#!/usr/bin/env python3
"""
Zero Incident - Safety Training Simulator
Generates the Data Flow Diagrams:
  * Level 1 (corrected) + six Level 2 decompositions (one per Level-1 process)
Output per diagram:  <name>.svg  (vector, report-ready)
Plus:  level2-dfd.drawio  (7 pages, editable in diagrams.net)
       preview-all.svg    (combined overview)

Notation (classic / Yourdon style, matching the Level 1 sheet):
  rectangle        = external entity
  circle           = process        (dashed circle = sibling process from the parent diagram)
  open bar (left)  = data store     (numbered D1..D5)
  labelled arrow   = data flow
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- helpers

class Diagram:
    def __init__(self, name, title, w, h, subtitle, legend):
        self.name, self.title, self.w, self.h = name, title, w, h
        self.subtitle, self.legend = subtitle, legend
        self.nodes = []   # dicts
        self.edges = []   # dicts
        self.nid = 0

    def _id(self, tag):
        self.nid += 1
        return f"{self.name[:1]}{self.nid}{tag}"

    def proc(self, x, y, r, num, lines, boundary=False):
        i = self._id("p")
        self.nodes.append(dict(kind="proc", id=i, x=x, y=y, r=r, num=num,
                               lines=lines, boundary=boundary))
        return i

    def ent(self, x, y, w, h, lines):
        i = self._id("e")
        self.nodes.append(dict(kind="ent", id=i, x=x, y=y, w=w, h=h, lines=lines))
        return i

    def store(self, x, y, w, h, dnum, lines):
        i = self._id("s")
        self.nodes.append(dict(kind="store", id=i, x=x, y=y, w=w, h=h,
                               dnum=dnum, lines=lines))
        return i

    def arrow(self, pts, label=None, label_xy=None, anchor="middle",
              dashed=False, both=False):
        self.edges.append(dict(pts=pts, label=label, label_xy=label_xy,
                               anchor=anchor, dashed=dashed, both=both))

    # ------------------------------------------------------------ SVG ----
    def svg(self):
        w, h = self.w, self.h
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
               f'viewBox="0 0 {w} {h}" font-family="Segoe UI, Arial, Helvetica, sans-serif">']
        out.append(f'<rect width="{w}" height="{h}" fill="#ffffff"/>')
        out.append('<defs>'
                   '<marker id="ah" markerWidth="9" markerHeight="8" refX="8" refY="3.5" orient="auto">'
                   '<path d="M0,0 L9,3.5 L0,7 z" fill="#333333"/></marker>'
                   '<marker id="ahs" markerWidth="9" markerHeight="8" refX="1" refY="3.5" orient="auto">'
                   '<path d="M9,0 L0,3.5 L9,7 z" fill="#333333"/></marker>'
                   '</defs>')
        # title block
        out.append(f'<text x="16" y="30" font-size="17" font-weight="700" fill="#12303a">{esc(self.title)}</text>')
        out.append(f'<text x="16" y="47" font-size="11.5" fill="#5a7680">{esc(self.subtitle)}</text>')
        out.append(f'<line x1="16" y1="55" x2="{w-16}" y2="55" stroke="#c9d8dc" stroke-width="1"/>')
        # edges first (under nodes? no - above fills, below labels) 
        for e in self.edges:
            pts = " ".join(f"{x},{y}" for x, y in e["pts"])
            dash = ' stroke-dasharray="7 5"' if e["dashed"] else ""
            mstart = ' marker-start="url(#ahs)"' if e["both"] else ""
            out.append(f'<polyline points="{pts}" fill="none" stroke="#333333" '
                       f'stroke-width="1.7"{dash}{mstart} marker-end="url(#ah)"/>')
        for n in self.nodes:
            if n["kind"] == "proc":
                x, y, r = n["x"], n["y"], n["r"]
                dash = ' stroke-dasharray="7 5"' if n["boundary"] else ""
                fill = "#eef5f2" if n["boundary"] else "#ffffff"
                out.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" '
                           f'stroke="#12303a" stroke-width="2"{dash}/>')
                ny = y - (len(n["lines"]) * 13) / 2 - 3
                out.append(f'<text x="{x}" y="{ny}" font-size="13" font-weight="700" '
                           f'fill="#12303a" text-anchor="middle">{esc(n["num"])}</text>')
                for i, line in enumerate(n["lines"]):
                    out.append(f'<text x="{x}" y="{ny + 15 + i * 13}" font-size="12" '
                               f'fill="#1c2b33" text-anchor="middle">{esc(line)}</text>')
            elif n["kind"] == "ent":
                x, y, w2, h2 = n["x"], n["y"], n["w"], n["h"]
                out.append(f'<rect x="{x}" y="{y}" width="{w2}" height="{h2}" '
                           f'fill="#ffffff" stroke="#12303a" stroke-width="2"/>')
                ty = y + h2 / 2 - (len(n["lines"]) - 1) * 7 + 4
                for i, line in enumerate(n["lines"]):
                    out.append(f'<text x="{x + w2 / 2}" y="{ty + i * 14}" font-size="12.5" '
                               f'font-weight="600" fill="#1c2b33" text-anchor="middle">{esc(line)}</text>')
            else:  # store: open bar, left side open, D-number badge
                x, y, w2, h2 = n["x"], n["y"], n["w"], n["h"]
                out.append(f'<path d="M {x},{y} H {x+w2} V {y+h2} H {x}" fill="#ffffff" '
                           f'stroke="#12303a" stroke-width="2"/>')
                out.append(f'<text x="{x + 4}" y="{y - 5}" font-size="12" font-weight="800" '
                           f'fill="#087f68">{esc(n["dnum"])}</text>')
                ty = y + h2 / 2 - (len(n["lines"]) - 1) * 7 + 4
                for i, line in enumerate(n["lines"]):
                    out.append(f'<text x="{x + w2 / 2 + 8}" y="{ty + i * 14}" font-size="12" '
                               f'fill="#1c2b33" text-anchor="middle">{esc(line)}</text>')
        # labels above everything
        for e in self.edges:
            if e["label"] and e["label_xy"]:
                lx, ly = e["label_xy"]
                lines = e["label"].split("\n")
                ly0 = ly - (len(lines) - 1) * 7
                for i, line in enumerate(lines):
                    yy = ly0 + i * 14
                    # halo pass (thick white stroke, no fill) + crisp fill pass on top
                    out.append(f'<text x="{lx}" y="{yy}" font-size="11.5" fill="none" '
                               f'stroke="#ffffff" stroke-width="4" stroke-linejoin="round" '
                               f'text-anchor="{e["anchor"]}">{esc(line)}</text>')
                    out.append(f'<text x="{lx}" y="{yy}" font-size="11.5" fill="#1a1a1a" '
                               f'text-anchor="{e["anchor"]}">{esc(line)}</text>')
        # legend
        out.append(f'<text x="16" y="{h - 12}" font-size="10.5" fill="#5a7680">{esc(self.legend)}</text>')
        out.append("</svg>")
        return "\n".join(out)

    # --------------------------------------------------------- draw.io ---
    def drawio_page(self, page_id):
        cells = ['<mxCell id="0"/>', f'<mxCell id="{page_id}1" parent="0"/>']
        for n in self.nodes:
            if n["kind"] == "proc":
                style = ("ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#12303a;"
                         "fontSize=12;fontStyle=0;")
                if n["boundary"]:
                    style = "ellipse;whiteSpace=wrap;html=1;fillColor=#eef5f2;strokeColor=#12303a;dashed=1;fontSize=12;"
                value = f'{n["num"]}<br>{"<br>".join(n["lines"])}'
                geo = dict(x=n["x"] - n["r"], y=n["y"] - n["r"], width=2 * n["r"], height=2 * n["r"])
            elif n["kind"] == "ent":
                style = "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#12303a;fontSize=12;fontStyle=1;"
                value = esc_dio(" ".join(n["lines"]))
                geo = dict(x=n["x"], y=n["y"], width=n["w"], height=n["h"])
            else:
                style = "shape=mxgraph.flowchart.data;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#12303a;fontSize=12;"
                value = esc_dio(f'{n["dnum"]}: {" ".join(n["lines"])}')
                geo = dict(x=n["x"], y=n["y"], width=n["w"], height=n["h"])
            g = (f'<mxGeometry x="{geo["x"]}" y="{geo["y"]}" '
                 f'width="{geo["width"]}" height="{geo["height"]}" as="geometry"/>')
            cells.append(f'<mxCell id="{n["id"]}" value="{esc(value)}" style="{style}" '
                         f'vertex="1" parent="{page_id}1">{g}</mxCell>')
        for i, e in enumerate(self.edges):
            # find endpoint node ids by nearest point
            src, tgt = nearest_nodes(self.nodes, e["pts"])
            style = "html=1;rounded=0;endArrow=block;endFill=1;strokeColor=#333333;fontSize=11;"
            if e["dashed"]:
                style += "dashed=1;"
            if e["both"]:
                style = style.replace("endArrow=block;", "endArrow=block;startArrow=block;")
            cells.append(f'<mxCell id="{page_id}e{i}" value="{esc_dio(e["label"] or "")}" '
                         f'style="{style}" edge="1" parent="{page_id}1" '
                         f'source="{src}" target="{tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>')
        return (f'<diagram id="{page_id}" name="{esc(self.title[:40])}">'
                f'<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" '
                f'connect="1" arrows="1" fold="1" page="1" pageScale="1" '
                f'pageWidth="{self.w}" pageHeight="{self.h}" math="0" shadow="0">'
                f'<root>{" ".join(cells)}</root></mxGraphModel></diagram>')


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def esc_dio(s):
    return esc(s).replace("\n", "&#xa;")


def nearest_nodes(nodes, pts):
    def dist(n, p):
        if n["kind"] == "proc":
            return ((n["x"] - p[0]) ** 2 + (n["y"] - p[1]) ** 2) ** 0.5 - n["r"]
        cx, cy = n["x"] + n["w"] / 2, n["y"] + n["h"] / 2
        return ((cx - p[0]) ** 2 + (cy - p[1]) ** 2) ** 0.5
    src = min(nodes, key=lambda n: dist(n, pts[0]))
    tgt = min(nodes, key=lambda n: dist(n, pts[-1]))
    if src is tgt:
        # disambiguate: pick second-best for target
        cands = sorted(nodes, key=lambda n: dist(n, pts[-1]))
        tgt = cands[1] if len(cands) > 1 else cands[0]
    return src["id"], tgt["id"]


# ----------------------------------------------------------------- pages

SUB = "Zero Incident \u2014 Safety Training Simulator \u00b7 Data Flow Diagram"
LEG_L2 = "Legend:  rectangle = external entity \u00b7 circle = process \u00b7 open bar = data store \u00b7 " \
         "dashed circle = sibling process from the parent Level 1 diagram \u00b7 every arrow is a named data flow"
LEG_L1 = "Legend:  rectangle = external entity \u00b7 circle = process \u00b7 open bar = data store (D1\u2013D5) \u00b7 " \
         "dashed arrow = retry flow \u00b7 every arrow is a named data flow"

pages = []

# ================= LEVEL 1 (corrected) =================
d = Diagram("L1", "Level 1 DFD \u2014 Zero Incident (corrected)", 960, 950,
            SUB + "  \u00b7  decomposition of the context (Level 0) process", LEG_L1)
e_adm = d.ent(36, 64, 150, 56, ["Administrator"])
e_emp = d.ent(36, 300, 150, 56, ["Employee / Learner"])
p1 = d.proc(300, 92, 52, "1.0", ["Authenticate", "User"])
p2 = d.proc(300, 242, 52, "2.0", ["Manage Training", "Hub"])
p3 = d.proc(300, 392, 52, "3.0", ["Deliver Training", "Module"])
p4 = d.proc(300, 542, 52, "4.0", ["Conduct Quiz &", "Record Activity"])
p5 = d.proc(300, 692, 52, "5.0", ["Calculate Score &", "Results"])
p6 = d.proc(300, 842, 52, "6.0", ["Manage Retry and", "Certificate"])
d1 = d.store(620, 64, 210, 56, "D1", ["User Accounts"])
d2 = d.store(620, 214, 210, 56, "D2", ["Training Module", "& Content"])
d4 = d.store(620, 364, 210, 56, "D4", ["User Progress &", "Module Scores"])
d3 = d.store(620, 514, 210, 56, "D3", ["Quiz Questions", "& Answers"])
d5 = d.store(620, 664, 210, 56, "D5", ["Results &", "Certificates"])
d.arrow([(186, 117), (248, 117)], "Manage Users\n(Add/Update/Delete)", (217, 99), both=True)
d.arrow([(352, 105), (620, 105)], "Verify Credentials", (486, 95))
d.arrow([(620, 129), (352, 129)], "User Data", (486, 145))
d.arrow([(300, 169), (300, 215)], "Authenticated User + Session", (310, 195))
d.arrow([(186, 343), (248, 283)], "3D Hub \u2194 Module Status", (212, 307), both=True, anchor="end")
d.arrow([(300, 319), (300, 365)], "Selected Module", (310, 347))
d.arrow([(352, 253), (620, 257)], "Read Module List & Content", (486, 241))
d.arrow([(620, 281), (352, 273)], "Module Data", (486, 297))
d.arrow([(352, 293), (620, 397)], "Read Progress & Scores", (452, 317))
d.arrow([(352, 397), (620, 289)], "Fetch Module Content & Assets", (500, 361))
d.arrow([(620, 305), (352, 421)], "Module Assets & 3D Scenes", (486, 381))
d.arrow([(248, 405), (186, 365)], "3d/360 Scenes & Resources", (180, 404), anchor="end")
d.arrow([(186, 353), (248, 393)], "Interaction / Activity Input", (180, 418), anchor="end")
d.arrow([(300, 469), (300, 515)], "Activity Complete", (310, 497))
d.arrow([(186, 369), (252, 553)], "Submitted Quiz Answers", (170, 467), anchor="end")
d.arrow([(252, 581), (186, 377)], "Quiz Questions", (170, 527), anchor="end")
d.arrow([(352, 553), (620, 557)], "Fetch Questions", (486, 541))
d.arrow([(620, 577), (352, 573)], "Questions & Correct Answers", (486, 593))
d.arrow([(300, 619), (300, 665)], "Submitted Answers", (310, 647))
d.arrow([(352, 703), (620, 423)], "Update Progress & Scores", (452, 613))
d.arrow([(352, 721), (620, 705)], "Save Final Result", (486, 701))
d.arrow([(300, 769), (300, 815)], "Result Record", (310, 797))
d.arrow([(352, 853), (620, 725)], "Generate Certificate (if eligible)", (486, 817))
d.arrow([(255, 905), (111, 905), (111, 381)], "Final Result &\nCertificate (PDF)", (103, 585), anchor="end")
d.arrow([(248, 855), (176, 855), (176, 567), (248, 567)], "Retake Request (score < 70)", (166, 715), anchor="end", dashed=True)
pages.append(d)

# ================= 2.1  -> 1.0 Authenticate User =================
d = Diagram("L1x", "Level 2 \u2014 Decomposition of 1.0 Authenticate User", 1000, 640,
            SUB, LEG_L2)
e1 = d.ent(36, 200, 150, 56, ["Employee / Learner"])
e2 = d.ent(36, 420, 150, 56, ["Administrator"])
a11 = d.proc(320, 228, 54, "1.1", ["Receive Login", "Request"])
a12 = d.proc(560, 228, 54, "1.2", ["Validate", "Credentials"])
a13 = d.proc(800, 228, 54, "1.3", ["Create Secure", "Session"])
a14 = d.proc(320, 448, 54, "1.4", ["Manage User", "Accounts"])
s1 = d.store(560, 420, 190, 56, "D1", ["User Accounts"])
d.arrow([(186, 228), (266, 228)], "Username & Password", (226, 214))
d.arrow([(374, 228), (506, 228)], "Login Request", (440, 214))
d.arrow([(575, 282), (575, 360), (620, 360), (620, 420)], "Lookup User Record", (565, 352), anchor="end")
d.arrow([(700, 420), (700, 378), (608, 378), (608, 282)], "Stored Credentials & Flags", (660, 396))
d.arrow([(614, 228), (746, 228)], "Verified User Data", (680, 214))
d.arrow([(515, 278), (515, 330), (111, 330), (111, 256)], "Login Error / Message", (300, 322))
d.arrow([(186, 448), (266, 448)], "Add / Update / Delete", (226, 434))
d.arrow([(374, 448), (560, 448)], "Create / Update / Delete User", (467, 434))
d.arrow([(854, 228), (985, 228)], "Authenticated User + Session\n(-> 2.0 Manage Training Hub)", (985, 212), anchor="end")
pages.append(d)

# ================= 2.2  -> 2.0 Manage Training Hub =================
d = Diagram("L2x", "Level 2 \u2014 Decomposition of 2.0 Manage Training Hub", 1000, 640,
            SUB, LEG_L2)
b10 = d.proc(110, 120, 44, "1.0", ["Authenticate"], boundary=True)
e1 = d.ent(300, 44, 180, 56, ["Employee / Learner"])
h21 = d.proc(290, 250, 54, "2.1", ["Load Training", "Overview"])
h22 = d.proc(560, 250, 54, "2.2", ["Render 3D", "Training Hub"])
h23 = d.proc(820, 250, 54, "2.3", ["Track Module", "Selection"])
s2 = d.store(170, 450, 200, 56, "D2", ["Training Module &", "Content"])
s4 = d.store(440, 450, 200, 56, "D4", ["User Progress &", "Scores"])
s5 = d.store(710, 450, 200, 56, "D5", ["Results &", "Certificates"])
d.arrow([(154, 140), (255, 205)], "Authenticated User + Session", (230, 152))
d.arrow([(270, 450), (282, 304)], "Module Catalog &\nMetadata", (252, 380), anchor="end")
d.arrow([(540, 450), (308, 300)], "Progress & Scores\nper Module", (452, 372))
d.arrow([(770, 450), (325, 298)], "Certificate Status", (555, 402))
d.arrow([(344, 250), (506, 250)], "Hub Data (modules,\nprogress, badges)", (425, 240))
d.arrow([(548, 196), (390, 100)], "Interactive 3D Hub \u2014 scenes, trainers, HUD", (440, 122))
d.arrow([(470, 100), (582, 198)], "Walk / Look / Interact", (532, 146))
d.arrow([(614, 250), (766, 250)], "Interaction Events", (690, 236))
d.arrow([(480, 72), (820, 72), (820, 196)], "Open Module Door", (648, 64))
d.arrow([(874, 250), (985, 250)], "Selected Module + Entry\nRequest (-> 3.0)", (928, 236))
pages.append(d)

# ================= 2.3  -> 3.0 Deliver Training Module =================
d = Diagram("L3x", "Level 2 \u2014 Decomposition of 3.0 Deliver Training Module", 1000, 640,
            SUB, LEG_L2)
b20 = d.proc(110, 120, 44, "2.0", ["Training Hub"], boundary=True)
e1 = d.ent(320, 44, 180, 56, ["Employee / Learner"])
m31 = d.proc(290, 250, 56, "3.1", ["Load Module Course", "& Assets"])
m32 = d.proc(560, 250, 56, "3.2", ["Deliver Interactive", "3D / 360 Scene"])
m33 = d.proc(820, 250, 56, "3.3", ["Record Training", "Activity"])
s2 = d.store(170, 450, 200, 56, "D2", ["Training Module &", "Content"])
s4 = d.store(710, 450, 200, 56, "D4", ["User Progress &", "Scores"])
d.arrow([(154, 140), (253, 208)], "Selected Module Key", (218, 158))
d.arrow([(270, 450), (282, 306)], "Course Steps, 3D Scene\n& Checkpoints", (258, 374), anchor="end")
d.arrow([(346, 250), (504, 250)], "Scene Config &\nResources", (425, 240))
d.arrow([(546, 194), (390, 100)], "3D Module Scene & Hotspots", (438, 122))
d.arrow([(470, 100), (594, 194)], "Checkpoint Decisions &\nActivity Events", (548, 146))
d.arrow([(616, 250), (764, 250)], "Activity Log\n(decisions, time)", (690, 240))
d.arrow([(820, 306), (820, 450)], "Update In-Progress Status", (832, 380), anchor="start")
d.arrow([(876, 250), (985, 250)], "Activity Complete \u2014\nReady for Quiz (-> 4.0)", (928, 236))
pages.append(d)

# ================= 2.4  -> 4.0 Conduct Quiz & Record Activity =================
d = Diagram("L4x", "Level 2 \u2014 Decomposition of 4.0 Conduct Quiz & Record Activity", 1000, 640,
            SUB, LEG_L2)
b30 = d.proc(110, 120, 44, "3.0", ["Deliver Module"], boundary=True)
e1 = d.ent(320, 44, 180, 56, ["Employee / Learner"])
q41 = d.proc(290, 250, 54, "4.1", ["Load Quiz", "Questions"])
q42 = d.proc(560, 250, 56, "4.2", ["Present Quiz &", "Collect Answers"])
q43 = d.proc(820, 250, 54, "4.3", ["Store Quiz", "Attempt"])
s3 = d.store(170, 450, 200, 56, "D3", ["Quiz Questions &", "Answers"])
s4 = d.store(710, 450, 200, 56, "D4", ["User Progress &", "Scores"])
d.arrow([(154, 140), (253, 208)], "Ready for Quiz", (218, 158))
d.arrow([(270, 450), (282, 304)], "Questions &\nCorrect Answers", (258, 374), anchor="end")
d.arrow([(344, 250), (504, 250)], "Question Set +\nMark Allocation", (424, 240))
d.arrow([(546, 194), (390, 100)], "Quiz Questions", (440, 126))
d.arrow([(470, 100), (594, 194)], "Submitted Answers", (540, 150))
d.arrow([(616, 250), (766, 250)], "Attempt Record\n(answers, duration)", (691, 240))
d.arrow([(820, 304), (820, 450)], "Save Attempt & Answers", (832, 380), anchor="start")
d.arrow([(874, 250), (985, 250)], "Submitted Answer\nSheet (-> 5.0)", (928, 236))
pages.append(d)

# ================= 2.5  -> 5.0 Calculate Score & Results =================
d = Diagram("L5x", "Level 2 \u2014 Decomposition of 5.0 Calculate Score & Results", 1000, 640,
            SUB, LEG_L2)
b40 = d.proc(110, 120, 44, "4.0", ["Conduct Quiz"], boundary=True)
s3 = d.store(250, 44, 210, 56, "D3", ["Quiz Questions &", "Answers"])
e1 = d.ent(680, 44, 180, 56, ["Employee / Learner"])
c51 = d.proc(310, 250, 54, "5.1", ["Grade Submitted", "Answers"])
c52 = d.proc(560, 250, 54, "5.2", ["Calculate Module", "Result"])
c53 = d.proc(820, 250, 54, "5.3", ["Update Progress &", "Save Result"])
s4 = d.store(450, 450, 200, 56, "D4", ["User Progress &", "Scores"])
s5 = d.store(710, 450, 200, 56, "D5", ["Results &", "Certificates"])
d.arrow([(154, 140), (275, 205)], "Submitted Answer Sheet", (230, 152))
d.arrow([(355, 100), (320, 196)], "Correct Answers &\nMarking Scheme", (400, 152))
d.arrow([(364, 250), (506, 250)], "Raw Score", (435, 236))
d.arrow([(614, 250), (766, 250)], "Final Result Data\n(score, pass/retake, grade)", (690, 240))
d.arrow([(792, 302), (550, 450)], "Update Progress &\nScores", (648, 384))
d.arrow([(840, 302), (812, 450)], "Save Final Result", (852, 380), anchor="start")
d.arrow([(592, 196), (770, 100)], "Result Summary \u2014\nScore & Classification", (672, 132))
d.arrow([(874, 250), (985, 250)], "Result Record\n(-> 6.0)", (928, 236))
pages.append(d)

# ================= 2.6  -> 6.0 Manage Retry and Certificate =================
d = Diagram("L6x", "Level 2 \u2014 Decomposition of 6.0 Manage Retry and Certificate", 1000, 640,
            SUB, LEG_L2)
e1 = d.ent(60, 44, 170, 56, ["Employee / Learner"])
b50 = d.proc(110, 150, 44, "5.0", ["Score & Results"], boundary=True)
b40 = d.proc(110, 440, 44, "4.0", ["Conduct Quiz"], boundary=True)
r61 = d.proc(300, 230, 56, "6.1", ["Evaluate Result &", "Eligibility"])
r62 = d.proc(560, 380, 54, "6.2", ["Handle", "Retake"])
r63 = d.proc(830, 230, 54, "6.3", ["Generate", "Certificate"])
s5 = d.store(540, 470, 200, 56, "D5", ["Results &", "Certificates"])
d.arrow([(152, 168), (255, 200)], "Module Result", (205, 198))
d.arrow([(590, 470), (330, 284)], "Stored Results (all modules)", (450, 392))
d.arrow([(320, 285), (525, 345)], "Fail Decision (score < 70)", (408, 314))
d.arrow([(356, 230), (776, 230)], "Eligible \u2014 all modules \u2265 70", (566, 220))
d.arrow([(510, 400), (510, 430), (280, 430), (280, 440), (154, 440)], "Retake Request (new attempt)", (388, 424))
d.arrow([(540, 434), (540, 560), (36, 560), (36, 72), (60, 72)], "Retake Notification", (200, 552))
d.arrow([(230, 72), (830, 72), (830, 176)], "Generate Certificate Request", (530, 64))
d.arrow([(820, 176), (820, 92), (230, 92)], "Completion Certificate (PDF)", (530, 108))
d.arrow([(830, 284), (700, 470)], "Save Certificate Record", (798, 386), anchor="start")
pages.append(d)

# ----------------------------------------------------------------- build

os.makedirs(HERE, exist_ok=True)

drawio_pages = []
for i, pg in enumerate(pages):
    page_id = f"pg{i}"
    with open(os.path.join(HERE, f"{pg.name}.svg"), "w", encoding="utf-8") as f:
        f.write(pg.svg())
    drawio_pages.append(pg.drawio_page(page_id))
    print(f"wrote {pg.name}.svg")

with open(os.path.join(HERE, "level2-dfd.drawio"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<mxfile host="app.diagrams.net" agent="ZeroIncident-DFD" version="24.0.0">\n'
            + "\n".join(drawio_pages)
            + "\n</mxfile>\n")
print("wrote level2-dfd.drawio")

# combined preview
tiles = [
    ("L1", 10, 60, 490, 485),
    ("L1x", 510, 60, 490, 327),
    ("L2x", 510, 397, 490, 327),
    ("L3x", 10, 565, 490, 327),
    ("L4x", 10, 902, 490, 327),
    ("L5x", 510, 734, 490, 327),
    ("L6x", 510, 1071, 490, 327),
]
PW, PH = 1010, 1250
prev = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{PW}" height="{PH}" viewBox="0 0 {PW} {PH}" '
        'font-family="Segoe UI, Arial, Helvetica, sans-serif">',
        f'<rect width="{PW}" height="{PH}" fill="#f4f7f6"/>',
        '<text x="20" y="34" font-size="20" font-weight="700" fill="#12303a">'
        'Zero Incident \u2014 Data Flow Diagrams (Level 1 corrected + Level 2 decompositions)</text>']
for name, x, y, tw, th in tiles:
    with open(os.path.join(HERE, f"{name}.svg"), encoding="utf-8") as f:
        body = f.read()
    # strip the outer <svg ...> and </svg>
    inner = body[body.index(">") + 1: body.rindex("</svg>")]
    vb_w = 960 if name == "L1" else 1000
    vb_h = 950 if name == "L1" else 640
    prev.append(f'<svg x="{x}" y="{y}" width="{tw}" height="{th}" viewBox="0 0 {vb_w} {vb_h}">'
                + inner + "</svg>")
prev.append("</svg>")
with open(os.path.join(HERE, "preview-all.svg"), "w", encoding="utf-8") as f:
    f.write("\n".join(prev))
print("wrote preview-all.svg")
