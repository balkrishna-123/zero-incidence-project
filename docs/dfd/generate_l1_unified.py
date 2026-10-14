#!/usr/bin/env python3
"""Level 1 DFD - unified/professor style (like the TEAM GALAXY sample).

Each Level-1 process gets its own horizontal band:
  external entities (left) <--> process (center) <--> data stores (right)
Processes are rounded boxes with the number in a header strip on top.
Every arrow is a named data flow; each entity/store connection is a
paired in/out arrow (or a single arrow for read/write only).

Outputs:
  L1-unified.svg / L1-unified.png (via cairosvg)
  level1-dfd-unified.drawio       (editable in diagrams.net)
"""

# ---------------- geometry ----------------
W, H = 1160, 1840
PROC_X, PROC_W, PROC_H = 460, 180, 175
ENT_X, ENT_W, ENT_H = 120, 130, 42
ST_X, ST_W, ST_H = 810, 200, 42
TOPS = [110, 405, 700, 995, 1290, 1585]

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

# ---------------- data ----------------
# (in_label, out_label); None = no arrow in that direction
BANDS = [
    dict(num="1.0", name=["Authenticate", "User"],
         ents=[("Administrator", ("Manage users (add / update / delete)",
                                  "User account updates & status")),
               ("Employee / Learner", ("Credentials: username & password",
                                       "Authentication result + session"))],
         stores=[("D1", "User Accounts",
                  ("User account & credential records", "Updated accounts & sessions"))]),
    dict(num="2.0", name=["Manage Training", "Hub"],
         ents=[("Employee / Learner", ("Training hub & progress request",
                                       "3D hub: modules, trainers, progress"))],
         stores=[("D2", "Training Module & Content", ("Module content & status records", None)),
                 ("D4", "User Progress & Module Scores", ("Previous progress & module scores", None))]),
    dict(num="3.0", name=["Deliver Training", "Module"],
         ents=[("Employee / Learner", ("Module selection & activity input",
                                       "3D/360\u00b0 scenes, briefings, resources"))],
         stores=[("D2", "Training Module & Content", ("3D/360\u00b0 content, scenes & assets", None)),
                 ("D4", "User Progress & Module Scores", (None, "Training activity record"))]),
    dict(num="4.0", name=["Conduct Quiz &", "Record Activity"],
         ents=[("Employee / Learner", ("Quiz attempt request & answers",
                                       "Quiz questions & instructions"))],
         stores=[("D3", "Quiz Questions & Answers", ("Quiz questions & correct answers", None)),
                 ("D4", "User Progress & Module Scores", (None, "Submitted answers & attempt record"))]),
    dict(num="5.0", name=["Calculate Score &", "Results"],
         ents=[("Employee / Learner", (None, "Module score & pass/fail result"))],
         stores=[("D3", "Quiz Questions & Answers", ("Correct answers for grading", None)),
                 ("D4", "User Progress & Module Scores", ("Stored attempt & answers", "Updated scores & progress")),
                 ("D5", "Results & Certificates", (None, "Module result record"))]),
    dict(num="6.0", name=["Manage Retry and", "Certificate"],
         ents=[("Employee / Learner", ("Completion & certificate request",
                                       "Completion certificate (PDF) + message"))],
         stores=[("D4", "User Progress & Module Scores", ("Module scores & completion status", None)),
                 ("D5", "Results & Certificates", ("Result & certificate records", "New certificate record"))]),
]

# per-band y positions (computed once, shared by svg + drawio)
def band_geom(b):
    g = {"top": TOPS[b]}
    # entities
    n = len(BANDS[b]["ents"])
    pos = []
    if n == 1:
        pos.append(TOPS[b] + 66)
    else:
        pos += [TOPS[b] + 16, TOPS[b] + 99]
    g["ents"] = pos
    # stores
    n = len(BANDS[b]["stores"])
    pos = []
    if n == 1:
        pos.append(TOPS[b] + 66)
    elif n == 2:
        pos += [TOPS[b] + 22, TOPS[b] + 110]
    else:
        pos += [TOPS[b] + 18, TOPS[b] + 66, TOPS[b] + 114]
    g["stores"] = pos
    return g

GEOMS = [band_geom(i) for i in range(len(BANDS))]

# ---------------- svg ----------------
def halo(text_out, x, y, label, size=9.5, weight="400", fill="#222222", anchor="middle"):
    for j, line in enumerate(label.split("\n")):
        yy = y + j * 13
        text_out.append(f'<text x="{x}" y="{yy}" font-size="{size}" font-weight="{weight}" fill="none" '
                        f'stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round" text-anchor="{anchor}">{esc(line)}</text>')
        text_out.append(f'<text x="{x}" y="{yy}" font-size="{size}" font-weight="{weight}" '
                        f'fill="{fill}" text-anchor="{anchor}">{esc(line)}</text>')

def build_svg():
    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
             f'viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">')
    o.append('<defs><marker id="ah" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">'
             '<path d="M0,0 L9,4 L0,8 Z" fill="#222222"/></marker></defs>')
    o.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#ffffff"/>')
    o.append(f'<text x="{W/2}" y="48" font-size="19" font-weight="700" text-anchor="middle" '
             f'fill="#111111" letter-spacing="1">ZERO INCIDENT - LEVEL 1 DATA FLOW DIAGRAM</text>')

    for i, band in enumerate(BANDS):
        g = GEOMS[i]
        top = g["top"]
        # process box
        o.append(f'<rect x="{PROC_X}" y="{top}" width="{PROC_W}" height="{PROC_H}" rx="12" '
                 f'fill="#ffffff" stroke="#111111" stroke-width="1.7"/>')
        o.append(f'<line x1="{PROC_X}" y1="{top+30}" x2="{PROC_X+PROC_W}" y2="{top+30}" stroke="#111111" stroke-width="1.3"/>')
        o.append(f'<text x="{PROC_X+PROC_W/2}" y="{top+21}" font-size="12.5" font-weight="700" '
                 f'text-anchor="middle" fill="#111111">{band["num"]}</text>')
        for j, line in enumerate(band["name"]):
            o.append(f'<text x="{PROC_X+PROC_W/2}" y="{top+92+j*21}" font-size="13.5" font-weight="700" '
                     f'text-anchor="middle" fill="#111111">{esc(line)}</text>')
        # entities
        for k, (ename, (lin, lout)) in enumerate(band["ents"]):
            ey = g["ents"][k]
            cy = ey + ENT_H / 2
            o.append(f'<rect x="{ENT_X}" y="{ey}" width="{ENT_W}" height="{ENT_H}" rx="4" '
                     f'fill="#ffffff" stroke="#111111" stroke-width="1.5"/>')
            o.append(f'<text x="{ENT_X+ENT_W/2}" y="{cy+4}" font-size="12" font-weight="700" '
                     f'text-anchor="middle" fill="#111111">{esc(ename)}</text>')
            if lin:
                ay = cy - 9
                o.append(f'<line x1="{ENT_X+ENT_W}" y1="{ay}" x2="{PROC_X-2}" y2="{ay}" stroke="#222222" '
                         f'stroke-width="1.5" marker-end="url(#ah)"/>')
                halo(o, (ENT_X+ENT_W+PROC_X)/2, ay-6, lin)
            if lout:
                ay = cy + 9
                o.append(f'<line x1="{PROC_X}" y1="{ay}" x2="{ENT_X+ENT_W+2}" y2="{ay}" stroke="#222222" '
                         f'stroke-width="1.5" marker-end="url(#ah)"/>')
                halo(o, (ENT_X+ENT_W+PROC_X)/2, ay+3, lout)
        # stores
        for k, (snum, sname, (sin, sout)) in enumerate(band["stores"]):
            sy = g["stores"][k]
            cy = sy + ST_H / 2
            o.append(f'<line x1="{ST_X}" y1="{sy}" x2="{ST_X+ST_W}" y2="{sy}" stroke="#111111" stroke-width="1.6"/>')
            o.append(f'<line x1="{ST_X}" y1="{sy+ST_H}" x2="{ST_X+ST_W}" y2="{sy+ST_H}" stroke="#111111" stroke-width="1.6"/>')
            o.append(f'<line x1="{ST_X}" y1="{sy}" x2="{ST_X}" y2="{sy+ST_H}" stroke="#111111" stroke-width="1.6"/>')
            o.append(f'<text x="{ST_X+12}" y="{sy+16}" font-size="11.5" font-weight="700" fill="#111111">{snum}</text>')
            o.append(f'<text x="{ST_X+12}" y="{sy+32}" font-size="11" fill="#111111">{esc(sname)}</text>')
            if sin:
                ay = cy - 9 if sout else cy
                o.append(f'<line x1="{ST_X-2}" y1="{ay}" x2="{PROC_X+PROC_W+2}" y2="{ay}" stroke="#222222" '
                         f'stroke-width="1.5" marker-end="url(#ah)"/>')
                halo(o, (PROC_X+PROC_W+ST_X)/2, ay-6, sin)
            if sout:
                ay = cy + 9 if sin else cy
                o.append(f'<line x1="{PROC_X+PROC_W}" y1="{ay}" x2="{ST_X-2}" y2="{ay}" stroke="#222222" '
                         f'stroke-width="1.5" marker-end="url(#ah)"/>')
                halo(o, (PROC_X+PROC_W+ST_X)/2, ay+3, sout)

    # dashed retake flow: 6.0 -> 4.0 along left margin
    start_y = TOPS[5] + 140          # 1725
    end_y = TOPS[3] + 50             # 1045
    pts = f"{PROC_X},{start_y} 70,{start_y} 70,{end_y} {PROC_X-2},{end_y}"
    o.append(f'<polyline points="{pts}" fill="none" stroke="#222222" stroke-width="1.5" '
             f'stroke-dasharray="7 5" marker-end="url(#ah)"/>')
    halo(o, 265, end_y - 7, "Retake request (score < 70%)", anchor="start")

    o.append(f'<text x="{W/2}" y="{H-26}" font-size="11" text-anchor="middle" fill="#555555">'
             f'Legend:  rectangle = external entity \u00b7 rounded box = process \u00b7 open bar = data store (D1\u2013D5) \u00b7 '
             f'dashed arrow = retry flow (retake)</text>')
    o.append('</svg>')
    return "\n".join(o)

# ---------------- draw.io ----------------
def esc_dio(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "&#10;")

def build_drawio():
    cells = ['<mxCell id="0"/><mxCell id="1" parent="0"/>']
    def cell(cid, value, style, x, y, w, h, parent="1", vertex=1):
        cells.append(f'<mxCell id="{cid}" value="{esc_dio(value)}" style="{style}" '
                     f'vertex="{vertex}" parent="{parent}"><mxGeometry x="{x}" y="{y}" '
                     f'width="{w}" height="{h}" as="geometry"/></mxCell>')

    cell("t0", "ZERO INCIDENT - LEVEL 1 DATA FLOW DIAGRAM",
         "text;html=1;align=center;fontSize=19;fontStyle=1;", 20, 24, W-40, 30)

    eid = 0
    store_line_cells = {}   # (band, store, side) -> cell id of left line
    for i, band in enumerate(BANDS):
        g = GEOMS[i]
        top = g["top"]
        pid = f"p{i}"
        cell(pid, "\n".join(band["name"]),
             "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#111111;strokeWidth=1.7;"
             "fontSize=13;fontStyle=1;verticalAlign=middle;", PROC_X, top, PROC_W, PROC_H)
        cell(f"p{i}ln", "", "endArrow=none;html=1;strokeWidth=1.3;fillColor=none;", PROC_X, top+30, PROC_W, 1)
        cell(f"p{i}num", band["num"],
             "text;html=1;align=center;fontSize=12;fontStyle=1;", PROC_X, top+3, PROC_W, 22)
        for k, (ename, _) in enumerate(band["ents"]):
            cell(f"e{i}_{k}", ename,
                 "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#111111;strokeWidth=1.5;"
                 "fontSize=12;fontStyle=1;", ENT_X, g["ents"][k], ENT_W, ENT_H)
        for k, (snum, sname, _) in enumerate(band["stores"]):
            sy = g["stores"][k]
            cell(f"s{i}_{k}t", "", "endArrow=none;html=1;strokeWidth=1.6;fillColor=none;", ST_X, sy, ST_W, 2)
            cell(f"s{i}_{k}b", "", "endArrow=none;html=1;strokeWidth=1.6;fillColor=none;", ST_X, sy+ST_H-2, ST_W, 2)
            lid = f"s{i}_{k}l"
            cell(lid, "", "endArrow=none;html=1;strokeWidth=1.6;fillColor=none;", ST_X, sy, 2, ST_H)
            cell(f"s{i}_{k}x", f"{snum}\n{sname}",
                 "text;html=1;align=left;verticalAlign=middle;fontSize=11;fontStyle=0;spacingLeft=8;",
                 ST_X+10, sy+2, ST_W-16, ST_H-4)
            store_line_cells[(i, k)] = lid

    # edges
    def edge(src, tgt, label, style_extra, mid=None):
        nonlocal eid
        eid += 1
        cid = f"ed{eid}"
        geo = f'<mxGeometry relative="1" as="geometry">'
        if mid:
            pts = "".join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in mid)
            geo += f"<Array as=\"points\">{pts}</Array>"
        geo += "</mxGeometry>"
        cells.append(f'<mxCell id="{cid}" value="{esc_dio(label)}" '
                     f'style="html=1;strokeWidth=1.6;endArrow=block;endFill=1;startArrow=none;'
                     f'fontSize=10;fontColor=#222222;{style_extra}" '
                     f'edge="1" parent="1" source="{src}" target="{tgt}">{geo}</mxCell>')

    for i, band in enumerate(BANDS):
        g = GEOMS[i]
        top = g["top"]
        for k, (ename, (lin, lout)) in enumerate(band["ents"]):
            ey = g["ents"][k]
            cy = ey + ENT_H / 2
            src = f"e{i}_{k}"
            if lin:
                ay = cy - 9
                edge(src, f"p{i}", lin,
                     f"exitX=1;exitY={ (ay-ey)/ENT_H:.3f};entryX=0;entryY={(ay-top)/PROC_H:.3f};")
            if lout:
                ay = cy + 9
                edge(f"p{i}", src, lout,
                     f"exitX=0;exitY={(ay-top)/PROC_H:.3f};entryX=1;entryY={(ay-ey)/ENT_H:.3f};")
        for k, (snum, sname, (sin, sout)) in enumerate(band["stores"]):
            sy = g["stores"][k]
            cy = sy + ST_H / 2
            lid = store_line_cells[(i, k)]
            if sin:
                ay = cy - 9 if sout else cy
                edge(lid, f"p{i}", sin,
                     f"exitX=1;exitY={(ay-sy)/ST_H:.3f};entryX=1;entryY={(ay-top)/PROC_H:.3f};")
            if sout:
                ay = cy + 9 if sin else cy
                edge(f"p{i}", lid, sout,
                     f"exitX=1;exitY={(ay-top)/PROC_H:.3f};entryX=1;entryY={(ay-sy)/ST_H:.3f};")

    # dashed retake 6.0 -> 4.0
    start_y = TOPS[5] + 140
    end_y = TOPS[3] + 50
    edge("p5", "p3", "Retake request (score < 70%)",
         f"dashed=1;dashPattern=8 4;exitX=0;exitY={(start_y-TOPS[5])/PROC_H:.3f};"
         f"entryX=0;entryY={(end_y-TOPS[3])/PROC_H:.3f};",
         mid=[(70, start_y), (70, end_y)])

    doc = ('<mxfile host="app.diagrams.net" agent="zero-incident-dfd" version="24.7.7">\n'
           '  <diagram id="l1unified" name="Level 1 (Unified Style)">\n    <mxGraphModel '
           'dx="1160" dy="1840" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
           'fold="0" page="1" pageScale="1" pageWidth="1160" pageHeight="1840" math="0" shadow="0">\n'
           '      <root>\n' + "\n".join(cells) + '\n      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n')
    return doc

svg = build_svg()
with open("L1-unified.svg", "w", encoding="utf-8") as f:
    f.write(svg)
with open("level1-dfd-unified.drawio", "w", encoding="utf-8") as f:
    f.write(build_drawio())
print("wrote L1-unified.svg + level1-dfd-unified.drawio")
