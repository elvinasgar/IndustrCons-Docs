import { getExcelTemplatesDB } from "./data.js";

function cardHTML(tpl) {
  return `
  <div class="card reveal">
    <h4>${tpl.title_az}</h4>
    <p style="font-size:0.85rem;">${tpl.desc_az}</p>
    <button class="btn btn-primary btn-block" data-download-xlsx="${tpl.id}">Excel Endir (.xlsx)</button>
  </div>`;
}

function buildWorkbook(tpl) {
  const wb = XLSX.utils.book_new();
  const headerRow = tpl.columns;
  const blankRows = Array.from({ length: 20 }, () => headerRow.map(() => ""));
  const aoa = [
    ["IndustrCons Docs —", tpl.title_az],
    [],
    headerRow,
    ...blankRows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Basic column widths
  ws["!cols"] = headerRow.map(() => ({ wch: 18 }));

  // Add a SUM formula under numeric-looking columns (last row + 1) as a starter,
  // e.g. useful for cost/quantity/weight sheets.
  const sumRow = aoa.length + 1;
  headerRow.forEach((col, i) => {
    if (/qiymət|məbləğ|çəki|həcm|miqdar|saat|azn/i.test(col)) {
      const colLetter = XLSX.utils.encode_col(i);
      const cellRef = `${colLetter}${sumRow}`;
      ws[cellRef] = { t: "n", f: `SUM(${colLetter}4:${colLetter}${sumRow - 1})` };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, "Cədvəl");
  return wb;
}

export async function initExcelTools(selector) {
  const grid = document.querySelector(selector);
  if (!grid) return;
  const { templates } = await getExcelTemplatesDB();
  grid.innerHTML = templates.map(cardHTML).join("");
  grid.querySelectorAll(".reveal").forEach((el) => requestAnimationFrame(() => el.classList.add("in")));

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-download-xlsx]");
    if (!btn) return;
    const tpl = templates.find((t) => t.id === btn.dataset.downloadXlsx);
    const wb = buildWorkbook(tpl);
    XLSX.writeFile(wb, `IndustrCons-${tpl.id}.xlsx`);
  });
}
