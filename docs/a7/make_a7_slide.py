#!/usr/bin/env python3
"""Build the two prototype slides for A7 (both in the deck's own template).

Slide 1: Prototype Overview        (image left, features right)
Slide 2: Live Prototype Demonstration  (steps left, hub mockup right)

Outputs:
  hand-phone-crop.png              (4:5 crop of the generated photo)
  live-prototype-slide.pdf/.png    (both slides, standalone + preview)
  live-prototype-slide.pptx        (both slides, editable in PowerPoint)
  A7-with-demo-slide.pdf           (A7 deck with both slides inserted after
                                    'What Actually Works Now')
"""
import fitz
import cairosvg
from PIL import Image

A7 = "/home/user/uploads/A7.pdf"
LOGO = "/home/user/uploads/a7img_6.png"  # Sunderland logo extracted from their deck
PAGE_W, PAGE_H = 960.0, 540.0
MAGENTA = (0.8, 0.0, 0.553)  # #CC008D sampled from the deck's footer bar
DARK = (0.05, 0.05, 0.05)
GREY = (0.35, 0.35, 0.35)

# ---------------------------------------------------------------- crop photo to 4:5
im = Image.open("hand-phone.jpg")
w, h = im.size
target_w, target_h = int(h * 0.8), h  # 4:5
if target_w > w:
    target_w, target_h = w, int(w * 1.25)
left = (w - target_w) // 2
top = (h - target_h) // 2
im.crop((left, top, left + target_w, top + target_h)).save("hand-phone-crop.png")
print("wrote hand-phone-crop.png")

# ---------------------------------------------------------------- mockup render
cairosvg.svg2png(url="slide-mockup.svg", write_to="slide-mockup.png", scale=2)
print("wrote slide-mockup.png")

DEMO_STEPS = [
    "Launch the Zero Incident Safety Training Simulator",
    "Sign in as an employee (demo account, auto-filled)",
    "Enter the walkable 3D warehouse training hub",
    "Open a module door and complete the 360\u00b0 practical activity",
    "Answer the timed quiz and decision prompts",
    "View score, retake route and completion certificate",
    "This demonstrates the system's usability and engagement potential",
]
OVERVIEW_FEATURES = [
    "3D warehouse hub and module selection screen",
    "Interactive 360\u00b0 practical activity (hazard spotting)",
    "Timed quiz and decision-based challenge",
    "Score feedback, retake and completion certificate",
]

# ---------------------------------------------------------------- shared PDF bits
def footer(page):
    page.draw_rect(fitz.Rect(0, PAGE_H - 18, PAGE_W, PAGE_H), color=MAGENTA, fill=MAGENTA)

def logo(page):
    lx = fitz.Pixmap(LOGO)
    lw = 74
    page.insert_image(fitz.Rect(PAGE_W - 48 - lw, 38, PAGE_W - 48, 38 + lw * lx.height / lx.width),
                      filename=LOGO)

def diamond(page, x, y):
    page.draw_polyline([(x, y - 5), (x + 5, y), (x, y + 5), (x - 5, y)],
                       closePath=True, color=MAGENTA, fill=MAGENTA)

# ---------------------------------------------------------------- slide 1: overview
def draw_overview(page):
    page.set_mediabox(fitz.Rect(0, 0, PAGE_W, PAGE_H))
    logo(page)
    # photo (left)
    iw, ih = 352.0, 440.0
    ix, iy = 64.0, 62.0
    page.draw_rect(fitz.Rect(ix - 4, iy - 4, ix + iw + 4, iy + ih + 4),
                   color=(0.55, 0.62, 0.7), fill=None, width=1.2)
    page.insert_image(fitz.Rect(ix, iy, ix + iw, iy + ih), filename="hand-phone-crop.png")
    # text (right)
    tx = 452.0
    page.insert_text((tx, 104), "Prototype Overview", fontname="hebo", fontsize=30, color=DARK)
    page.insert_text((tx, 152), "Prototype Features Demonstrated", fontname="hebo", fontsize=14.5, color=DARK)
    y = 190
    for text in OVERVIEW_FEATURES:
        diamond(page, tx + 6, y - 4)
        page.insert_text((tx + 20, y), text, fontname="helv", fontsize=12.5, color=(0.1, 0.1, 0.1))
        y += 28
    page.insert_text((tx, 336), "The prototype focuses on validating", fontname="heit", fontsize=11.5, color=GREY)
    bold_w = fitz.get_text_length("interaction concepts", fontname="hebo", fontsize=11.5)
    page.insert_text((tx, 356), "interaction concepts", fontname="hebo", fontsize=11.5, color=DARK)
    page.insert_text((tx + bold_w, 356), ", not full system deployment.", fontname="heit", fontsize=11.5, color=GREY)
    footer(page)

# ---------------------------------------------------------------- slide 2: live demo
def draw_demo(page):
    page.set_mediabox(fitz.Rect(0, 0, PAGE_W, PAGE_H))
    logo(page)
    page.insert_text((48, 92), "Live Prototype Demonstration", fontname="hebo", fontsize=30, color=DARK)
    page.insert_text((48, 142), "Demonstration Steps", fontname="hebo", fontsize=14.5, color=DARK)
    y = 176
    for text in DEMO_STEPS:
        diamond(page, 55, y - 4)
        page.insert_text((68, y), text, fontname="helv", fontsize=11.5, color=(0.1, 0.1, 0.1))
        y += 27
    page.insert_text((48, 398),
                     "Demo file: demo.html - double-click to open in any browser (no server, no internet needed).",
                     fontname="heit", fontsize=10, color=GREY)
    page.insert_text((48, 416),
                     "Live system: npm start, then open http://localhost:3000  (demo account: ramesh.s / Welcome!2026)",
                     fontname="heit", fontsize=10, color=GREY)
    iw = 424.0
    ih = iw * 560 / 880
    ix, iy = 478.0, 122.0
    page.draw_rect(fitz.Rect(ix - 4, iy - 4, ix + iw + 4, iy + ih + 4),
                   color=(0.55, 0.62, 0.7), fill=None, width=1.2)
    page.insert_image(fitz.Rect(ix, iy, ix + iw, iy + ih), filename="slide-mockup.png")
    page.insert_textbox(fitz.Rect(ix, iy + ih + 10, ix + iw, iy + ih + 30),
                        "3D training hub - demo.html (interactive)",
                        fontsize=10, fontname="heit", color=GREY, align=fitz.TEXT_ALIGN_CENTER)
    footer(page)

# ---------------------------------------------------------------- standalone PDF + preview
doc = fitz.open()
for fn in (draw_overview, draw_demo):
    p = doc.new_page(width=PAGE_W, height=PAGE_H)
    fn(p)
doc.save("live-prototype-slide.pdf")
doc.close()
prev = fitz.open("live-prototype-slide.pdf")
prev[0].get_pixmap(dpi=150).save("live-prototype-slide.png")
prev[1].get_pixmap(dpi=150).save("live-prototype-demo.png")
prev.close()
print("wrote live-prototype-slide.pdf/.png (2 slides)")

# ---------------------------------------------------------------- insert into A7
src = fitz.open(A7)
idx = None
for i in range(len(src)):
    if "What Actually Works Now" in src[i].get_text():
        idx = i
        break
assert idx is not None, "could not locate 'What Actually Works Now' page"
new = fitz.open("live-prototype-slide.pdf")
src.insert_pdf(new, from_page=0, to_page=1, start_at=idx + 1)  # overview, then demo
src.save("A7-with-demo-slide.pdf")
print("wrote A7-with-demo-slide.pdf (", len(src), "pages ) - inserted after page", idx + 1)

# ---------------------------------------------------------------- pptx (2 slides)
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]

def new_slide():
    s = prs.slides.add_slide(BLANK)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(7.28), Inches(13.333), Inches(0.22))
    bar.fill.solid()
    bar.fill.fore_color.rgb = RGBColor(0xCC, 0x00, 0x8D)
    bar.line.fill.background()
    s.shapes.add_picture(LOGO, Inches(10.9), Inches(0.5), width=Inches(1.85))
    return s

def add_text(slide, x, y, w, h, text, size, bold=False, italic=False,
             color=(0x14, 0x14, 0x14), align=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.name = "Arial"
    r.font.color.rgb = RGBColor(*color)
    return tb

# ---- slide 1: Prototype Overview
s1 = new_slide()
s1.shapes.add_picture("hand-phone-crop.png", Inches(0.8), Inches(0.85), height=Inches(5.4))
add_text(s1, 5.55, 1.05, 6.2, 0.7, "Prototype Overview", 30, bold=True)
add_text(s1, 5.55, 2.05, 6.4, 0.4, "Prototype Features Demonstrated", 14.5, bold=True)
tb = s1.shapes.add_textbox(Inches(5.55), Inches(2.6), Inches(6.6), Inches(2.6))
tf = tb.text_frame
tf.word_wrap = True
for i, text in enumerate(OVERVIEW_FEATURES):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    p.space_after = Pt(10)
    r1 = p.add_run(); r1.text = "\u25c6  "
    r1.font.size = Pt(12.5); r1.font.color.rgb = RGBColor(0xCC, 0x00, 0x8D); r1.font.name = "Arial"
    r2 = p.add_run(); r2.text = text
    r2.font.size = Pt(12.5); r2.font.color.rgb = RGBColor(0x1a, 0x1a, 0x1a); r2.font.name = "Arial"
tb = s1.shapes.add_textbox(Inches(5.55), Inches(5.0), Inches(6.8), Inches(0.8))
tf = tb.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
for text, bold in [("The prototype focuses on validating ", False),
                   ("interaction concepts", True),
                   (", not full system deployment.", False)]:
    r = p.add_run()
    r.text = text
    r.font.size = Pt(11.5)
    r.font.italic = True
    r.font.bold = bold
    r.font.name = "Arial"
    r.font.color.rgb = RGBColor(0x59, 0x59, 0x59) if not bold else RGBColor(0x14, 0x14, 0x14)

# ---- slide 2: Live Prototype Demonstration
s2 = new_slide()
add_text(s2, 0.67, 0.62, 8.5, 0.8, "Live Prototype Demonstration", 30, bold=True)
add_text(s2, 0.67, 1.55, 5.6, 0.4, "Demonstration Steps", 14.5, bold=True)
tb = s2.shapes.add_textbox(Inches(0.67), Inches(2.05), Inches(5.9), Inches(3.6))
tf = tb.text_frame
tf.word_wrap = True
for i, text in enumerate(DEMO_STEPS):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    p.space_after = Pt(9)
    r1 = p.add_run(); r1.text = "\u25c6  "
    r1.font.size = Pt(11.5); r1.font.color.rgb = RGBColor(0xCC, 0x00, 0x8D); r1.font.name = "Arial"
    r2 = p.add_run(); r2.text = text
    r2.font.size = Pt(11.5); r2.font.color.rgb = RGBColor(0x1a, 0x1a, 0x1a); r2.font.name = "Arial"
add_text(s2, 0.67, 5.85, 6.4, 0.35,
         "Demo file: demo.html - double-click to open in any browser (no server, no internet needed).",
         10, italic=True, color=(0x59, 0x59, 0x59))
add_text(s2, 0.67, 6.22, 6.4, 0.35,
         "Live system: npm start, then open http://localhost:3000  (demo account: ramesh.s / Welcome!2026)",
         10, italic=True, color=(0x59, 0x59, 0x59))
s2.shapes.add_picture("slide-mockup.png", Inches(6.95), Inches(1.62), width=Inches(5.55))
add_text(s2, 6.95, 5.42, 5.55, 0.3, "3D training hub - demo.html (interactive)",
         10, italic=True, color=(0x59, 0x59, 0x59), align=PP_ALIGN.CENTER)

prs.save("live-prototype-slide.pptx")
print("wrote live-prototype-slide.pptx (2 slides)")
