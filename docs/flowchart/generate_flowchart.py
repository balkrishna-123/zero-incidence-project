#!/usr/bin/env python3
"""
Zero Incident - Safety Training Simulator
Structural (classic program) flowchart of the whole system:
  login -> validation -> session -> role split (admin / employee)
  -> 3D training hub -> module -> practical activity -> quiz -> scoring
  -> retry/continue loops -> completion certificate -> sign out
Outputs: structural-flowchart.svg/.png (via cairosvg) + structural-flowchart.drawio
Notation: stadium = start/end, rectangle = process, parallelogram = input/output,
rhombus = decision.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))


class Flow:
    def __init__(self, title, subtitle, w, h):
        self.title, self.subtitle, self.w, self.h = title, subtitle, w, h
        self.nodes = []
        self.edges = []

    def node(self, kind, cx, cy, w, h, lines):
        self.nodes.append(dict(kind=kind, cx=cx, cy=cy, w=w, h=h, lines=lines))
        return len(self.nodes) - 1

    def term(self, cx, cy, w, h, lines):
        return self.node("term", cx, cy, w, h, lines)

    def proc(self, cx, cy, w, h, lines):
        return self.node("proc", cx, cy, w, h, lines)

    def io(self, cx, cy, w, h, lines):
        return self.node("io", cx, cy, w, h, lines)

    def dec(self, cx, cy, w, h, lines):
        return self.node("dec", cx, cy, w, h, lines)

    def arrow(self, pts, label=None, label_xy=None, anchor="middle"):
        self.edges.append(dict(pts=pts, label=label, label_xy=label_xy, anchor=anchor))

    def dot(self, x, y):
        self.edges.append(dict(dot=(x, y)))

    # ------------------------------------------------------------- SVG ---
    STYLES = {
        "term": ("#e8f5e9", "#2e7d32"),
        "proc": ("#ffffff", "#12303a"),
        "io": ("#e3f2fd", "#12303a"),
        "dec": ("#fff8e1", "#12303a"),
    }

    def svg(self):
        w, h = self.w, self.h
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
               f'viewBox="0 0 {w} {h}" font-family="Segoe UI, Arial, Helvetica, sans-serif">']
        out.append(f'<rect width="{w}" height="{h}" fill="#ffffff"/>')
        out.append('<defs>'
                   '<marker id="ah" markerWidth="9" markerHeight="8" refX="8" refY="3.5" orient="auto">'
                   '<path d="M0,0 L9,3.5 L0,7 z" fill="#333333"/></marker></defs>')
        out.append(f'<text x="20" y="30" font-size="18" font-weight="700" fill="#12303a">{esc(self.title)}</text>')
        out.append(f'<text x="20" y="48" font-size="11.5" fill="#5a7680">{esc(self.subtitle)}</text>')
        out.append(f'<line x1="20" y1="56" x2="{w-20}" y2="56" stroke="#c9d8dc" stroke-width="1"/>')
        for e in self.edges:
            if e.get("dot"):
                x, y = e["dot"]
                out.append(f'<circle cx="{x}" cy="{y}" r="4" fill="#333333"/>')
        for n in self.nodes:
            cx, cy, nw, nh = n["cx"], n["cy"], n["w"], n["h"]
            fill, stroke = self.STYLES[n["kind"]]
            if n["kind"] == "term":
                out.append(f'<rect x="{cx-nw/2}" y="{cy-nh/2}" width="{nw}" height="{nh}" rx="{nh/2}" '
                           f'fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
            elif n["kind"] == "proc":
                out.append(f'<rect x="{cx-nw/2}" y="{cy-nh/2}" width="{nw}" height="{nh}" '
                           f'fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
            elif n["kind"] == "io":
                s = 20
                x, y = cx - nw / 2, cy - nh / 2
                out.append(f'<polygon points="{x+s},{y} {x+nw},{y} {x+nw-s},{y+nh} {x},{y+nh}" '
                           f'fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
            else:
                out.append(f'<polygon points="{cx},{cy-nh/2} {cx+nw/2},{cy} {cx},{cy+nh/2} {cx-nw/2},{cy}" '
                           f'fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
            ty = cy - (len(n["lines"]) - 1) * 8
            for i, line in enumerate(n["lines"]):
                fs = 13 if n["kind"] == "term" else (12.5 if n["kind"] == "dec" else 12.5)
                fw = " font-weight=\"700\"" if n["kind"] in ("term", "dec") else ""
                out.append(f'<text x="{cx}" y="{ty + i * 16 + 4}" font-size="{fs}"{fw} '
                           f'fill="#1c2b33" text-anchor="middle">{esc(line)}</text>')
        for e in self.edges:
            if not e.get("pts"):
                continue
            pts = " ".join(f"{x},{y}" for x, y in e["pts"])
            out.append(f'<polyline points="{pts}" fill="none" stroke="#333333" '
                       f'stroke-width="1.7" marker-end="url(#ah)"/>')
        for e in self.edges:
            if e.get("label") and e.get("label_xy"):
                lx, ly = e["label_xy"]
                for j, line in enumerate(e["label"].split("\n")):
                    yy = ly + j * 14
                    out.append(f'<text x="{lx}" y="{yy}" font-size="11.5" font-weight="700" fill="none" '
                               f'stroke="#ffffff" stroke-width="4" stroke-linejoin="round" '
                               f'text-anchor="{e["anchor"]}">{esc(line)}</text>')
                    out.append(f'<text x="{lx}" y="{yy}" font-size="11.5" font-weight="700" '
                               f'fill="#0b5d4e" text-anchor="{e["anchor"]}">{esc(line)}</text>')
        out.append(f'<text x="20" y="{h - 12}" font-size="10.5" fill="#5a7680">'
                   "Legend:  stadium = start/end \u00b7 rectangle = process \u00b7 parallelogram = input/output \u00b7 "
                   "rhombus = decision (Yes/No) \u00b7 D1\u2013D5 = data stores (see DFD)\n</text>")
        out.append("</svg>")
        return "\n".join(out)

    # ---------------------------------------------------------- draw.io --
    def drawio_page(self, page_id="fc"):
        cells = ['<mxCell id="0"/>', f'<mxCell id="{page_id}1" parent="0"/>']
        dstyle = {
            "term": "rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#e8f5e9;strokeColor=#2e7d32;fontSize=12;fontStyle=1;",
            "proc": "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#12303a;fontSize=12;",
            "io": "shape=parallelogram;perimeter=parallelogramPerimeter;fixedWidth=1;whiteSpace=wrap;html=1;fillColor=#e3f2fd;strokeColor=#12303a;fontSize=12;",
            "dec": "rhombus;whiteSpace=wrap;html=1;fillColor=#fff8e1;strokeColor=#12303a;fontSize=12;fontStyle=1;",
        }
        for i, n in enumerate(self.nodes):
            value = esc_dio("<br>".join(n["lines"]))
            g = (f'<mxGeometry x="{n["cx"]-n["w"]/2}" y="{n["cy"]-n["h"]/2}" '
                 f'width="{n["w"]}" height="{n["h"]}" as="geometry"/>')
            cells.append(f'<mxCell id="{page_id}n{i}" value="{value}" style="{dstyle[n["kind"]]}" '
                         f'vertex="1" parent="{page_id}1">{g}</mxCell>')
        for i, e in enumerate(self.edges):
            if e.get("dot"):
                continue
            src, tgt = nearest(self.nodes, e["pts"])
            style = ("edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;"
                     "strokeColor=#333333;fontSize=11;fontStyle=1;")
            cells.append(f'<mxCell id="{page_id}e{i}" value="{esc_dio(e["label"] or "")}" style="{style}" '
                         f'edge="1" parent="{page_id}1" source="{src}" target="{tgt}">'
                         f'<mxGeometry relative="1" as="geometry"/></mxCell>')
        return (f'<diagram id="{page_id}" name="Structural Flowchart">'
                f'<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" '
                f'connect="1" arrows="1" fold="1" page="1" pageScale="1" '
                f'pageWidth="{self.w}" pageHeight="{self.h}" math="0" shadow="0">'
                f'<root>{" ".join(cells)}</root></mxGraphModel></diagram>')


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def esc_dio(s):
    return esc(s).replace("\n", "&#xa;")


def nearest(nodes, pts):
    def dist(n, p):
        return ((n["cx"] - p[0]) ** 2 + (n["cy"] - p[1]) ** 2) ** 0.5
    src = min(nodes, key=lambda n: dist(n, pts[0]))
    tgt = min(nodes, key=lambda n: dist(n, pts[-1]))
    if src is tgt:
        cands = sorted(nodes, key=lambda n: dist(n, pts[-1]))
        tgt = cands[1]
    return f"fcn{nodes.index(src)}", f"fcn{nodes.index(tgt)}"


# ------------------------------------------------------------------ page
f = Flow("Structural Flowchart \u2014 Zero Incident (Safety Training Simulator)",
         "Complete program flow: login \u2192 validation \u2192 session \u2192 role split \u2192 3D hub \u2192 module \u2192 quiz \u2192 result \u2192 certificate",
         1080, 2830)

# main column (cx=480)
f.term(480, 84, 180, 48, ["START"])
f.proc(480, 176, 400, 56, ["Initialize application \u2014", "load config \u00b7 connect MongoDB \u00b7 start HTTP server"])
f.io(480, 268, 360, 48, ["Display login screen"])
f.io(480, 356, 360, 48, ["Enter username & password"])
f.proc(480, 444, 400, 48, ["Verify credentials against D1 (User Accounts)"])
f.dec(480, 563, 280, 110, ["Credentials", "valid?"])
f.dec(480, 713, 300, 110, ["New password required?", "(first login)?"])
f.proc(480, 832, 400, 48, ["Create secure session \u2014 cookie + CSRF token"])
f.dec(480, 951, 240, 110, ["User role?"])
f.proc(480, 1072, 400, 56, ["Load training hub \u2014 360\u00b0 warehouse:", "module overview (D2) + progress (D4)"])
f.io(480, 1166, 360, 48, ["Display 3D hub \u2014 trainer introduces modules"])
f.dec(480, 1285, 300, 110, ["Employee selects", "a module?"])
f.proc(480, 1408, 400, 56, ["Enter module room \u2014 load content", "and 3D assets (D2)"])
f.io(480, 1504, 400, 56, ["Deliver 3D/360\u00b0 scene: briefing +", "practical activity"])
f.dec(480, 1627, 320, 110, ["Practical activity", "completed?"])
f.proc(480, 1746, 400, 48, ["Fetch quiz questions & correct answers (D3)"])
f.io(480, 1834, 380, 48, ["Display quiz questions (knowledge check)"])
f.io(480, 1922, 380, 48, ["Employee submits answers"])
f.proc(480, 2010, 400, 48, ["Calculate score & result (pass mark \u2265 70%)"])
f.proc(480, 2098, 400, 48, ["Save attempt \u2014 update progress & scores (D4)"])
f.dec(480, 2217, 260, 110, ["Score \u2265 70%?"])
f.dec(480, 2367, 320, 110, ["All 3 modules", "passed?"])
f.proc(480, 2496, 400, 56, ["Generate completion certificate (PDF)", "\u2014 save to D5"])
f.io(480, 2584, 360, 48, ["Display & download certificate"])
f.proc(480, 2672, 360, 48, ["Destroy session (sign out)"])
f.term(480, 2756, 180, 48, ["END"])

# right column: error, first-login, admin
err = f.io(905, 456, 230, 52, ["Show error message"])
npw = f.io(905, 713, 230, 48, ["Enter new password"])
upd = f.proc(905, 801, 230, 48, ["Update password in D1"])
adm = f.proc(905, 951, 230, 56, ["Manage users (add/update/delete)", "\u2014 D1 User Accounts"])
admout = f.proc(905, 1043, 230, 48, ["Destroy session (sign out)"])
f.term(905, 1121, 120, 48, ["END"])

# left cluster: fail result + retake
res = f.io(150, 2217, 200, 48, ["Show result \u2014", "retake available"])
ret = f.dec(150, 2335, 150, 84, ["Retake now?"])

# ---- main column arrows
f.arrow([(480, 108), (480, 148)])
f.arrow([(480, 204), (480, 244)])
f.arrow([(480, 292), (480, 332)])
f.arrow([(480, 380), (480, 420)])
f.arrow([(480, 468), (480, 508)])
f.arrow([(480, 618), (480, 658)], "Yes", (496, 640), anchor="start")
f.arrow([(480, 768), (480, 808)], "No", (496, 788), anchor="start")
f.arrow([(480, 856), (480, 896)])
f.arrow([(480, 1006), (480, 1044)], "Employee", (496, 1030), anchor="start")
f.arrow([(480, 1100), (480, 1142)])
f.arrow([(480, 1190), (480, 1230)])
f.arrow([(480, 1340), (480, 1380)], "Yes", (496, 1362), anchor="start")
f.arrow([(480, 1436), (480, 1476)])
f.arrow([(480, 1532), (480, 1572)])
f.arrow([(480, 1682), (480, 1722)], "Yes", (496, 1704), anchor="start")
f.arrow([(480, 1770), (480, 1810)])
f.arrow([(480, 1858), (480, 1898)])
f.arrow([(480, 1946), (480, 1986)])
f.arrow([(480, 2034), (480, 2074)])
f.arrow([(480, 2122), (480, 2162)])
f.arrow([(480, 2272), (480, 2312)], "Yes", (496, 2294), anchor="start")
f.arrow([(480, 2422), (480, 2468)], "Yes", (496, 2444), anchor="start")
f.arrow([(480, 2524), (480, 2560)])
f.arrow([(480, 2608), (480, 2648)])
f.arrow([(480, 2696), (480, 2732)])

# ---- credentials invalid -> error -> back to login input
f.arrow([(620, 563), (905, 563), (905, 482)], "No", (700, 553))
f.arrow([(905, 430), (905, 356), (660, 356)])

# ---- first login -> new password -> update -> merge into main flow
f.arrow([(630, 713), (790, 713)], "Yes", (700, 703))
f.arrow([(905, 737), (905, 777)])
f.arrow([(905, 825), (905, 788), (480, 788)])
f.dot(480, 788)

# ---- admin branch
f.arrow([(600, 951), (790, 951)], "Administrator", (695, 941))
f.arrow([(905, 979), (905, 1019)])
f.arrow([(905, 1067), (905, 1097)])

# ---- keep browsing hub (no module selected)
f.arrow([(330, 1285), (150, 1285), (150, 1156), (300, 1156)], "No", (240, 1275))

# ---- repeat practical activity
f.arrow([(640, 1627), (740, 1627), (740, 1504), (660, 1504)], "No", (688, 1617))

# ---- failed module: show result -> retake?
f.arrow([(350, 2217), (250, 2217)], "No", (300, 2207))
f.arrow([(150, 2241), (150, 2293)])
f.arrow([(75, 2335), (30, 2335), (30, 1746), (280, 1746)], "Yes", (50, 2325))
f.arrow([(150, 2377), (150, 2450), (265, 2450), (265, 1176), (300, 1176)], "No", (162, 2415), anchor="start")

# ---- remaining modules -> back to hub display
f.arrow([(640, 2367), (720, 2367), (720, 1186), (660, 1186)], "No", (676, 2357))

# ------------------------------------------------------------------ build
os.makedirs(HERE, exist_ok=True)
svg = f.svg()
with open(os.path.join(HERE, "structural-flowchart.svg"), "w", encoding="utf-8") as fh:
    fh.write(svg)
with open(os.path.join(HERE, "structural-flowchart.drawio"), "w", encoding="utf-8") as fh:
    fh.write('<?xml version="1.0" encoding="UTF-8"?>\n'
             '<mxfile host="app.diagrams.net" agent="ZeroIncident-DFD" version="24.0.0">\n'
             + f.drawio_page("fc") + "\n</mxfile>\n")
print("wrote structural-flowchart.svg + .drawio")
