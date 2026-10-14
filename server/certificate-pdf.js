import PDFDocument from "pdfkit";
import { openSync } from "fontkit";
import path from "node:path";
import { ROOT } from "./config.js";

const dir = path.join(ROOT, "server/assets/certificate-fonts");
const files = {
  regular: path.join(dir, "NotoSans-Regular.ttf"),
  bold: path.join(dir, "NotoSans-Bold.ttf"),
  deva: path.join(dir, "NotoSansDevanagari-Regular.ttf"),
  devaBold: path.join(dir, "NotoSansDevanagari-Bold.ttf"),
};
const loaded = new Map();
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
function fontRuns(text, bold = false) {
  const result = [];
  for (const { segment } of segmenter.segment(text)) {
    const key = /\p{Script=Devanagari}/u.test(segment)
      ? bold
        ? "devaBold"
        : "deva"
      : bold
        ? "bold"
        : "regular";
    if (!loaded.has(key)) loaded.set(key, openSync(files[key]));
    const font = loaded.get(key);
    if (
      [...segment].some(
        (ch) =>
          !/[\u200c\u200d]/u.test(ch) &&
          !font.hasGlyphForCodePoint(ch.codePointAt(0)),
      )
    ) {
      throw Object.assign(
        new Error(
          "The certificate fonts support Latin and Devanagari names. Contact your administrator to arrange a suitable font for other characters before issuing.",
        ),
        { status: 422, code: "CERTIFICATE_FONT_UNSUPPORTED" },
      );
    }
    if (result.at(-1)?.font === key) result.at(-1).text += segment;
    else result.push({ font: key, text: segment });
  }
  return result;
}
export function assertCertificateText(name, identifier) {
  fontRuns(name, true);
  fontRuns(identifier || "");
}
export function certificateDate(value, timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}
export async function renderCertificatePDF(record) {
  assertCertificateText(record.employeeName, record.employeeIdentifier);
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    compress: true,
    info: {
      Title: `Zero Incident — ${record.certificateId}`,
      Author: "Zero Incident",
      Subject: "Digital learning completion record",
      Creator: "Zero Incident",
      CreationDate: new Date(record.issuedAt),
      ModDate: new Date(record.issuedAt),
    },
  });
  const chunks = [];
  const buffer = new Promise((resolve, reject) => {
    doc.on("data", (b) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  for (const [key, file] of Object.entries(files)) doc.registerFont(key, file);
  const W = doc.page.width,
    H = doc.page.height;
  const red = "#db293d",
    ink = "#253248",
    muted = "#6a7789",
    line = "#dce1e7";
  const text = (value, x, y, width, size = 10, options = {}) => {
    doc
      .font(options.bold ? "bold" : "regular")
      .fontSize(size)
      .fillColor(options.color || ink)
      .text(String(value), x, y, { width, lineBreak: false, ...options });
  };
  const centre = (value, y, size, options = {}) =>
    text(value, 57, y, W - 114, size, { align: "center", ...options });
  const rule = (y) =>
    doc
      .moveTo(60, y)
      .lineTo(W - 60, y)
      .lineWidth(0.65)
      .strokeColor(line)
      .stroke();
  function widthOf(value, size, bold) {
    return fontRuns(value, bold).reduce(
      (sum, r) => sum + doc.font(r.font).fontSize(size).widthOfString(r.text),
      0,
    );
  }
  function mixedLine(value, baseline, size, bold = false) {
    let x = (W - widthOf(value, size, bold)) / 2;
    for (const run of fontRuns(value, bold)) {
      doc
        .font(run.font)
        .fontSize(size)
        .fillColor(ink)
        .text(run.text, x, baseline, {
          lineBreak: false,
          baseline: "alphabetic",
        });
      x += doc.widthOfString(run.text);
    }
  }
  function nameLines(size) {
    const lines = [];
    let current = "";
    for (const { segment } of segmenter.segment(record.employeeName)) {
      if (current && widthOf(current + segment, size, true) > W - 145) {
        lines.push(current);
        current = segment;
      } else current += segment;
    }
    if (current) lines.push(current);
    return lines;
  }
  doc.rect(0, 0, W, H).fill("#fbfbf9");
  doc
    .roundedRect(25, 25, W - 50, H - 50, 5)
    .lineWidth(0.8)
    .strokeColor("#cfd6df")
    .stroke();
  doc.rect(25, 25, 6, H - 50).fill(red);
  doc
    .save()
    .translate(56, 48)
    .scale(1.18)
    .path("M12 2L3 6v6c0 6 9 11 9 11s9-5 9-11V6L12 2Z")
    .lineWidth(1.4)
    .strokeColor(ink)
    .stroke();
  doc.path("M8 12l3 3 5-6").lineWidth(1.3).strokeColor(red).stroke().restore();
  text("ZERO", 89, 48, 45, 12, { bold: true });
  text("INCIDENT", 125, 48, 105, 12, { bold: true, color: red });
  text("SAFETY LEARNING", 90, 66, 210, 6.3, {
    color: muted,
    characterSpacing: 1.2,
  });
  text(
    record.demoLearner ? "DEMO LEARNER RECORD" : "DIGITAL LEARNING RECORD",
    W - 293,
    49,
    235,
    7.4,
    { align: "right", color: muted, characterSpacing: 1.1 },
  );
  text(record.certificateId, W - 323, 66, 265, 7.5, {
    align: "right",
    color: muted,
  });
  centre("Certificate of Completion", 108, 30, { bold: true });
  centre(record.programTitle.toUpperCase(), 154, 8.3, {
    color: muted,
    characterSpacing: 2.1,
  });
  centre("This certifies that", 188, 10.5, { color: muted });
  let size = 33;
  while (size > 20 && widthOf(record.employeeName, size, true) > W - 145)
    size -= 0.5;
  let lines = nameLines(size);
  while (lines.length > 2 && size > 11) {
    size -= 0.5;
    lines = nameLines(size);
  }
  lines.forEach((value, i) =>
    mixedLine(
      value.trim(),
      lines.length === 1 ? 245 : 227 + i * (size + 6),
      size,
      true,
    ),
  );
  mixedLine(
    `${record.identifierLabel}: ${record.employeeIdentifier}`,
    278,
    9.3,
  );
  centre(
    "has completed and passed all three Zero Incident learning modules.",
    292,
    10.5,
    { color: muted },
  );
  const x = 66,
    y = 328,
    tableWidth = 590;
  doc.roundedRect(x, y, tableWidth, 112, 4).fill("#f0f2f5");
  text("REQUIRED MODULE", x + 15, y + 10, 318, 7.2, {
    color: muted,
    bold: true,
    characterSpacing: 0.7,
  });
  text("SCORE", x + 359, y + 10, 90, 7.2, { color: muted, bold: true });
  text("RESULT", x + 466, y + 10, 99, 7.2, { color: muted, bold: true });
  record.modules.forEach((m, i) => {
    const yy = y + 33 + i * 24;
    if (i)
      doc
        .moveTo(x + 14, yy - 5)
        .lineTo(x + tableWidth - 14, yy - 5)
        .strokeColor(line)
        .lineWidth(0.5)
        .stroke();
    text(m.title, x + 15, yy, 324, 10.2);
    text(`${m.score} / 100`, x + 359, yy, 95, 10.2, { bold: true });
    text(m.score >= 85 ? "Excellent" : "Pass", x + 466, yy, 99, 9.4, {
      color: "#237c63",
    });
  });
  doc.circle(732, 383, 41).lineWidth(2).strokeColor(red).stroke();
  text("3 / 3", 687, 354, 90, 26, { bold: true, align: "center" });
  text("MODULES PASSED", 686, 391, 92, 6.1, {
    align: "center",
    color: muted,
    characterSpacing: 0.7,
  });
  text(
    `Overall score: ${Number(record.overallScore).toFixed(1)} / 100  ·  Every module passed at 70 or above`,
    x + 2,
    451,
    691,
    8.5,
    { color: muted },
  );
  rule(477);
  text("COMPLETED", 66, 490, 150, 6.8, {
    bold: true,
    color: muted,
    characterSpacing: 1,
  });
  text(certificateDate(record.completedAt, record.timeZone), 66, 503, 203, 9.2);
  text("ISSUED", 305, 490, 180, 6.8, {
    bold: true,
    color: muted,
    characterSpacing: 1,
  });
  text(certificateDate(record.issuedAt, record.timeZone), 305, 503, 211, 9.2);
  text("ISSUED BY", 556, 490, 205, 6.8, {
    bold: true,
    color: muted,
    characterSpacing: 1,
  });
  text("Zero Incident", 556, 503, 205, 9.2, { bold: true });
  centre(
    "Best verified marks are captured at issue. This is a record of digital learning, not practical competence certification,",
    535,
    7,
    { color: muted },
  );
  centre(
    "a licence or authorisation to perform hazardous work. Follow workplace training and assessed procedures.",
    546,
    7,
    { color: muted },
  );
  doc.end();
  return buffer;
}
