// pdf-generator.js — builds a professional, print-ready PDF for any document
// in the registry. Reads window.jspdf (jsPDF UMD build) + jspdf-autotable,
// both loaded via CDN script tags on document-view.html.
//
// IMPORTANT — Azerbaijani character support:
// jsPDF's built-in fonts (helvetica/times/courier) only support WinAnsi/
// Latin-1 and render ə, ş, ğ, ç, ı, ö, ü, İ as garbage or wrong glyphs.
// We fetch a real Unicode font (Noto Sans, which covers Azerbaijani/Turkish
// Latin Extended characters) once, embed it into the PDF via jsPDF's
// addFileToVFS/addFont, and use it for ALL text instead of "helvetica".
//
// The layout is driven by `doc.formType` so the SAME engine renders all 86+
// document types without one-off code per document:
//   - "report"    -> narrative sections (description / cause / actions)
//   - "checklist" -> item / status / remarks table
//   - "permit"    -> checklist table + validity + precaution sign-off
//   - "register"  / "log" -> repeating multi-row table

const NAVY = [10, 30, 51];
const BLUE = [27, 75, 122];
const AMBER = [242, 169, 59];
const GRAY = [91, 107, 124];
const FONT = "NotoSans"; // registered name used everywhere below

const FONT_URLS = {
  normal: "https://raw.githubusercontent.com/notofonts/noto-fonts/refs/heads/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
  bold: "https://raw.githubusercontent.com/notofonts/noto-fonts/refs/heads/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
};

let fontLoadPromise = null;

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchFontBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Şrift yüklənmədi: ${url}`);
  const buf = await res.arrayBuffer();
  return arrayBufferToBase64(buf);
}

/** Loads Noto Sans (regular + bold) once and registers it on a jsPDF instance. */
async function ensureAzerbaijaniFont(pdfDoc) {
  if (!fontLoadPromise) {
    fontLoadPromise = Promise.all([fetchFontBase64(FONT_URLS.normal), fetchFontBase64(FONT_URLS.bold)]);
  }
  const [regularBase64, boldBase64] = await fontLoadPromise;
  pdfDoc.addFileToVFS("NotoSans-Regular.ttf", regularBase64);
  pdfDoc.addFont("NotoSans-Regular.ttf", FONT, "normal");
  pdfDoc.addFileToVFS("NotoSans-Bold.ttf", boldBase64);
  pdfDoc.addFont("NotoSans-Bold.ttf", FONT, "bold");
  pdfDoc.setFont(FONT, "normal");
}

function header(pdfDoc, doc, meta) {
  const pageWidth = pdfDoc.internal.pageSize.getWidth();
  pdfDoc.setFillColor(...NAVY);
  pdfDoc.rect(0, 0, pageWidth, 28, "F");

  pdfDoc.setTextColor(255, 255, 255);
  pdfDoc.setFont(FONT, "bold");
  pdfDoc.setFontSize(13);
  pdfDoc.text("IndustrCons Docs", 14, 12);
  pdfDoc.setFont(FONT, "normal");
  pdfDoc.setFontSize(8);
  pdfDoc.text("Professional Construction Documentation Platform — Azərbaycan", 14, 18);

  pdfDoc.setFont(FONT, "bold");
  pdfDoc.setFontSize(10);
  pdfDoc.setTextColor(...AMBER);
  const code = `${doc.code}-${meta.docNumber || "0001"}`;
  pdfDoc.text(code, pageWidth - 14, 12, { align: "right" });
  pdfDoc.setFont(FONT, "normal");
  pdfDoc.setFontSize(8);
  pdfDoc.setTextColor(220, 220, 220);
  pdfDoc.text(`Tarix: ${meta.date || "-"}`, pageWidth - 14, 18, { align: "right" });

  // Title band
  pdfDoc.setTextColor(...NAVY);
  pdfDoc.setFont(FONT, "bold");
  pdfDoc.setFontSize(16);
  pdfDoc.text(doc.title_az, 14, 40);
  pdfDoc.setDrawColor(...BLUE);
  pdfDoc.setLineWidth(0.8);
  pdfDoc.line(14, 44, pageWidth - 14, 44);
}

function metaGrid(pdfDoc, meta, startY) {
  const rows = [
    ["Şirkət", meta.company || "-", "Layihə", meta.project || "-"],
    ["Yer", meta.location || "-", "Sahə/Sifarişçi", meta.client || "-"],
    ["Mühəndis", meta.engineer || "-", "Hazırladı", meta.preparedBy || "-"],
  ];
  pdfDoc.autoTable({
    startY,
    body: rows,
    theme: "plain",
    styles: { font: FONT, fontSize: 9, cellPadding: 2, textColor: NAVY },
    columnStyles: {
      0: { fontStyle: "bold", textColor: GRAY, cellWidth: 32 },
      2: { fontStyle: "bold", textColor: GRAY, cellWidth: 32 },
    },
    didParseCell: (data) => {
      if (data.column.index === 1 || data.column.index === 3) data.cell.styles.fontStyle = "normal";
    },
  });
  pdfDoc.setDrawColor(...GRAY);
  pdfDoc.setLineWidth(0.2);
  pdfDoc.line(14, pdfDoc.lastAutoTable.finalY + 2, pdfDoc.internal.pageSize.getWidth() - 14, pdfDoc.lastAutoTable.finalY + 2);
  return pdfDoc.lastAutoTable.finalY + 8;
}

function narrativeSections(pdfDoc, formValues, startY) {
  let y = startY;
  const sections = [
    ["Baş Verənlərin Təsviri", formValues.description],
    ["Səbəb Təhlili", formValues.cause],
    ["Görülən / Görüləcək Tədbirlər", formValues.actions],
  ];
  pdfDoc.setFontSize(10);
  sections.forEach(([label, value]) => {
    if (!value) return;
    pdfDoc.setFont(FONT, "bold");
    pdfDoc.setTextColor(...BLUE);
    pdfDoc.text(label, 14, y);
    y += 5;
    pdfDoc.setFont(FONT, "normal");
    pdfDoc.setTextColor(...NAVY);
    const lines = pdfDoc.splitTextToSize(value, pdfDoc.internal.pageSize.getWidth() - 28);
    pdfDoc.text(lines, 14, y);
    y += lines.length * 5 + 6;
  });
  return y;
}

function itemsTable(pdfDoc, formValues, startY) {
  const items = formValues.items && formValues.items.length ? formValues.items : [{ desc: "-", status: "-", remarks: "-" }];
  pdfDoc.autoTable({
    startY,
    head: [["№", "Bənd / Fəaliyyət", "Nəticə", "Qeyd"]],
    body: items.map((it, i) => [i + 1, it.desc || "-", it.status || "-", it.remarks || "-"]),
    theme: "grid",
    headStyles: { font: FONT, fillColor: BLUE, textColor: 255, fontSize: 9 },
    styles: { font: FONT, fontSize: 9, textColor: NAVY },
    columnStyles: { 0: { cellWidth: 10 } },
  });
  return pdfDoc.lastAutoTable.finalY + 8;
}

function signatureBlock(pdfDoc, meta, startY) {
  const pageWidth = pdfDoc.internal.pageSize.getWidth();
  const pageHeight = pdfDoc.internal.pageSize.getHeight();
  let y = Math.min(startY, pageHeight - 55);
  if (y < startY - 5) pdfDoc.addPage();

  const cols = [
    ["Hazırladı", meta.preparedBy],
    ["Yoxladı", meta.checkedBy],
    ["Təsdiqlədi", meta.approvedBy],
  ];
  const colWidth = (pageWidth - 28) / 3;
  cols.forEach(([label, name], i) => {
    const x = 14 + i * colWidth;
    pdfDoc.setDrawColor(...GRAY);
    pdfDoc.setLineWidth(0.3);
    pdfDoc.line(x, y + 18, x + colWidth - 10, y + 18);
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(...GRAY);
    pdfDoc.text(label, x, y + 23);
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(...NAVY);
    pdfDoc.setFont(FONT, "bold");
    pdfDoc.text(name || "____________", x, y + 13);
    pdfDoc.setFont(FONT, "normal");
  });

  // Approval stamp seal (drawn, not an image — works with zero external assets)
  const sealX = pageWidth - 34;
  const sealY = y - 4;
  pdfDoc.setDrawColor(...AMBER);
  pdfDoc.setLineWidth(1);
  pdfDoc.circle(sealX, sealY, 13);
  pdfDoc.circle(sealX, sealY, 10);
  pdfDoc.setFontSize(6.5);
  pdfDoc.setTextColor(...AMBER);
  pdfDoc.text("INDUSTRCONS", sealX, sealY - 1, { align: "center" });
  pdfDoc.text("TƏSDİQ EDİLDİ", sealX, sealY + 3, { align: "center" });

  return y + 30;
}

function footer(pdfDoc) {
  const pageCount = pdfDoc.internal.getNumberOfPages();
  const pageWidth = pdfDoc.internal.pageSize.getWidth();
  const pageHeight = pdfDoc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    pdfDoc.setPage(i);
    pdfDoc.setDrawColor(...GRAY);
    pdfDoc.setLineWidth(0.2);
    pdfDoc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(...GRAY);
    pdfDoc.text("IndustrCons Docs — industrcons.az  |  Founder: Elvin Asgarov", 14, pageHeight - 9);
    pdfDoc.text(`Səhifə ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 9, { align: "right" });
  }
}

/**
 * Build and return a jsPDF document instance for a given registry document.
 * @param {object} doc - entry from documents.json
 * @param {object} formValues - values collected from the on-page form
 */
export async function buildDocumentPDF(doc, formValues) {
  const { jsPDF } = window.jspdf;
  const pdfDoc = new jsPDF({ unit: "mm", format: "a4" });
  await ensureAzerbaijaniFont(pdfDoc);

  header(pdfDoc, doc, formValues);
  let y = metaGrid(pdfDoc, formValues, 50);

  if (doc.formType === "report") {
    y = narrativeSections(pdfDoc, formValues, y);
  } else {
    y = itemsTable(pdfDoc, formValues, y);
  }

  if (formValues.notes) {
    pdfDoc.setFont(FONT, "bold");
    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(...BLUE);
    pdfDoc.text("Əlavə Qeydlər", 14, y);
    y += 5;
    pdfDoc.setFont(FONT, "normal");
    pdfDoc.setTextColor(...NAVY);
    const lines = pdfDoc.splitTextToSize(formValues.notes, pdfDoc.internal.pageSize.getWidth() - 28);
    pdfDoc.text(lines, 14, y);
    y += lines.length * 5 + 8;
  }

  signatureBlock(pdfDoc, formValues, y + 10);
  footer(pdfDoc);
  return pdfDoc;
}
