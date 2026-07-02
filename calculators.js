import { getCalculatorsDB, getGeometryDB } from "./data.js";

const round = (n, d = 3) => (Number.isFinite(n) ? Number(n.toFixed(d)) : 0);
const PI = Math.PI;

/* ------------------------------------------------------------------
 * Engineering calculator formulas.
 * Each function receives an object of numeric input values (already
 * parsed) keyed by the calculator's `inputs[].key`, and returns an
 * array of { label, value, unit } results.
 * ------------------------------------------------------------------ */
export const ENGINES = {
  concreteVolume: ({ length, width, height, wastage = 0 }) => {
    const base = length * width * height;
    const total = base * (1 + wastage / 100);
    return [
      { label: "Xalis həcm", value: round(base), unit: "m³" },
      { label: "Ehtiyatla birlikdə", value: round(total), unit: "m³" },
    ];
  },
  concreteMix: ({ volume, ratioCement = 1, ratioSand = 2, ratioAggregate = 4 }) => {
    const dry = volume * 1.54;
    const sum = ratioCement + ratioSand + ratioAggregate;
    const cementVol = (dry * ratioCement) / sum;
    const sandVol = (dry * ratioSand) / sum;
    const aggVol = (dry * ratioAggregate) / sum;
    const cementBags = (cementVol * 1440) / 50;
    return [
      { label: "Sement", value: round(cementVol), unit: "m³" },
      { label: "Sement kisələri (50kg)", value: round(cementBags, 1), unit: "kisə" },
      { label: "Qum", value: round(sandVol), unit: "m³" },
      { label: "Çınqıl", value: round(aggVol), unit: "m³" },
    ];
  },
  rebarWeight: ({ diameter, length, qty = 1 }) => {
    const unitWeight = (diameter * diameter) / 162;
    const total = unitWeight * length * qty;
    return [
      { label: "Metr üzrə çəki", value: round(unitWeight), unit: "kg/m" },
      { label: "Ümumi çəki", value: round(total, 2), unit: "kg" },
    ];
  },
  rebarCutting: ({ memberLength, spacing, cover = 50 }) => {
    const availableMM = memberLength * 1000 - 2 * cover;
    const bars = Math.floor(availableMM / spacing) + 1;
    return [
      { label: "Lazım olan çubuq sayı", value: bars, unit: "ədəd" },
      { label: "Faktiki addım", value: round(availableMM / (bars - 1 || 1), 1), unit: "mm" },
    ];
  },
  steelSectionWeight: ({ unitWeight, length, qty = 1 }) => {
    const total = unitWeight * length * qty;
    return [{ label: "Ümumi çəki", value: round(total, 2), unit: "kg" }];
  },
  brickCalc: ({ wallArea, brickLength = 250, brickHeight = 65, mortarJoint = 10, wastage = 5 }) => {
    const perM2 = 1 / (((brickLength + mortarJoint) / 1000) * ((brickHeight + mortarJoint) / 1000));
    const total = wallArea * perM2 * (1 + wastage / 100);
    return [
      { label: "1 m²-də kərpic sayı", value: round(perM2, 1), unit: "ədəd/m²" },
      { label: "Ümumi kərpic sayı", value: Math.ceil(total), unit: "ədəd" },
    ];
  },
  blockCalc: ({ wallArea, blockLength = 600, blockHeight = 200, wastage = 5 }) => {
    const perM2 = 1 / ((blockLength / 1000) * (blockHeight / 1000));
    const total = wallArea * perM2 * (1 + wastage / 100);
    return [
      { label: "1 m²-də blok sayı", value: round(perM2, 2), unit: "ədəd/m²" },
      { label: "Ümumi blok sayı", value: Math.ceil(total), unit: "ədəd" },
    ];
  },
  tileCalc: ({ roomArea, tileLength = 600, tileWidth = 600, wastage = 10 }) => {
    const perM2 = 1 / ((tileLength / 1000) * (tileWidth / 1000));
    const total = roomArea * perM2 * (1 + wastage / 100);
    return [
      { label: "1 m²-də kafel sayı", value: round(perM2, 2), unit: "ədəd/m²" },
      { label: "Ümumi kafel sayı", value: Math.ceil(total), unit: "ədəd" },
    ];
  },
  paintCalc: ({ wallArea, coverage = 10, coats = 2 }) => {
    const litres = (wallArea * coats) / coverage;
    return [{ label: "Lazım olan boya", value: round(litres, 1), unit: "litr" }];
  },
  excavationVolume: ({ length, width, depth, bulking = 20 }) => {
    const base = length * width * depth;
    const bulked = base * (1 + bulking / 100);
    return [
      { label: "Yerində həcm (bank)", value: round(base), unit: "m³" },
      { label: "Boşalmış həcm (nəql üçün)", value: round(bulked), unit: "m³" },
    ];
  },
  backfillVolume: ({ excavationVolume, structureVolume, compaction = 15 }) => {
    const net = Math.max(0, excavationVolume - structureVolume);
    const loose = net * (1 + compaction / 100);
    return [
      { label: "Xalis doldurma həcmi", value: round(net), unit: "m³" },
      { label: "Sıxlaşdırma üçün material", value: round(loose), unit: "m³" },
    ];
  },
  slabCalc: ({ length, width, thickness, steelRatio = 80 }) => {
    const volume = length * width * (thickness / 1000);
    const steel = volume * steelRatio;
    return [
      { label: "Beton həcmi", value: round(volume), unit: "m³" },
      { label: "Təxmini armatur çəkisi", value: round(steel, 1), unit: "kg" },
    ];
  },
  beamCalc: ({ length, width, depth, qty = 1, steelRatio = 120 }) => {
    const volume = length * (width / 1000) * (depth / 1000) * qty;
    const steel = volume * steelRatio;
    return [
      { label: "Beton həcmi", value: round(volume), unit: "m³" },
      { label: "Təxmini armatur çəkisi", value: round(steel, 1), unit: "kg" },
    ];
  },
  columnCalc: ({ width, depth, height, qty = 1, steelRatio = 150 }) => {
    const volume = (width / 1000) * (depth / 1000) * height * qty;
    const steel = volume * steelRatio;
    return [
      { label: "Beton həcmi", value: round(volume), unit: "m³" },
      { label: "Təxmini armatur çəkisi", value: round(steel, 1), unit: "kg" },
    ];
  },
  footingCalc: ({ length, width, depth, qty = 1 }) => {
    const volume = length * width * depth * qty;
    return [{ label: "Ümumi beton həcmi", value: round(volume), unit: "m³" }];
  },
  stairCalc: ({ totalRise, riserHeight = 175, treadWidth = 280 }) => {
    const risers = Math.round(totalRise / riserHeight);
    const actualRiser = totalRise / risers;
    const treads = risers - 1;
    const totalRun = treads * treadWidth;
    return [
      { label: "Pillə (riser) sayı", value: risers, unit: "ədəd" },
      { label: "Faktiki pillə hündürlüyü", value: round(actualRiser, 1), unit: "mm" },
      { label: "Pillə (tread) sayı", value: treads, unit: "ədəd" },
      { label: "Ümumi üfüqi uzunluq", value: round(totalRun / 1000, 2), unit: "m" },
    ];
  },
  pipeCalc: ({ diameter, length }) => {
    const r = diameter / 2 / 1000;
    const volume = PI * r * r * length;
    return [{ label: "Daxili həcm", value: round(volume, 3), unit: "m³" }];
  },
  slopeCalc: ({ rise, run }) => {
    const percent = (rise / run) * 100;
    const degrees = (Math.atan(rise / run) * 180) / PI;
    return [
      { label: "Meyllik", value: round(percent, 2), unit: "%" },
      { label: "Bucaq", value: round(degrees, 2), unit: "°" },
    ];
  },

  // Geometry tools
  triangle: ({ base, height, sideA, sideB, sideC }) => {
    const out = [];
    if (base && height) out.push({ label: "Sahə", value: round(0.5 * base * height), unit: "m²" });
    if (sideA && sideB && sideC) out.push({ label: "Perimetr", value: round(sideA + sideB + sideC), unit: "m" });
    return out;
  },
  rectangle: ({ length, width }) => [
    { label: "Sahə", value: round(length * width), unit: "m²" },
    { label: "Perimetr", value: round(2 * (length + width)), unit: "m" },
  ],
  circle: ({ radius }) => [
    { label: "Sahə", value: round(PI * radius * radius), unit: "m²" },
    { label: "Çevrə", value: round(2 * PI * radius), unit: "m" },
  ],
  trapezoid: ({ a, b, height }) => [{ label: "Sahə", value: round(0.5 * (a + b) * height), unit: "m²" }],
  cylinder: ({ radius, height }) => [
    { label: "Həcm", value: round(PI * radius * radius * height), unit: "m³" },
    { label: "Səthi sahə", value: round(2 * PI * radius * (radius + height)), unit: "m²" },
  ],
  cone: ({ radius, height }) => [{ label: "Həcm", value: round((1 / 3) * PI * radius * radius * height), unit: "m³" }],
  sphere: ({ radius }) => [
    { label: "Həcm", value: round((4 / 3) * PI * radius ** 3), unit: "m³" },
    { label: "Səthi sahə", value: round(4 * PI * radius * radius), unit: "m²" },
  ],
  pipeSection: ({ outerD, innerD }) => [
    { label: "Kəsik sahəsi", value: round((PI / 4) * (outerD ** 2 - innerD ** 2), 1), unit: "mm²" },
  ],
  iBeam: ({ h, b, tw, tf }) => [
    { label: "Təxmini kəsik sahəsi", value: round(2 * b * tf + (h - 2 * tf) * tw, 1), unit: "mm²" },
  ],
  boxSection: ({ h, b, t }) => [
    { label: "Kəsik sahəsi", value: round(h * b - (h - 2 * t) * (b - 2 * t), 1), unit: "mm²" },
  ],
};

function calcCardHTML(calc) {
  return `
  <a class="card card-hover reveal" href="calculator-view.html?id=${calc.id}">
    <h4 style="margin-bottom:var(--sp-2)">${calc.title_az}</h4>
    <p style="font-size:0.85rem;margin:0;">${calc.desc}</p>
  </a>`;
}

export async function initCalculatorsGrid(selector) {
  const grid = document.querySelector(selector);
  if (!grid) return;
  const { calculators } = await getCalculatorsDB();
  grid.innerHTML = calculators.map(calcCardHTML).join("");
  grid.querySelectorAll(".reveal").forEach((el) => requestAnimationFrame(() => el.classList.add("in")));
}

export async function initGeometryGrid(selector) {
  const grid = document.querySelector(selector);
  if (!grid) return;
  const { tools } = await getGeometryDB();
  grid.innerHTML = tools
    .map((t) => `<a class="card card-hover reveal" href="calculator-view.html?id=${t.id}&type=geometry"><h4 style="margin-bottom:var(--sp-2)">${t.title_az}</h4><p style="font-size:0.85rem;margin:0;">${t.desc}</p></a>`)
    .join("");
  grid.querySelectorAll(".reveal").forEach((el) => requestAnimationFrame(() => el.classList.add("in")));
}

/** Generic form + live results renderer for a single calculator or geometry tool. */
export async function initCalculatorView() {
  const root = document.querySelector("[data-calc-viewer]");
  if (!root) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const isGeometry = params.get("type") === "geometry";

  const db = isGeometry ? await getGeometryDB() : await getCalculatorsDB();
  const item = isGeometry ? db.tools.find((t) => t.id === id) : db.calculators.find((c) => c.id === id);

  if (!item) {
    root.innerHTML = "<p>Kalkulyator tapılmadı.</p>";
    return;
  }
  document.title = `${item.title_az} — IndustrCons Docs`;

  root.innerHTML = `
    <h1 style="font-size:1.9rem;">${item.title_az}</h1>
    <p style="max-width:600px;">${item.desc}</p>
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:var(--sp-6); align-items:start;">
      <form class="card" data-calc-form>
        <div class="form-grid" style="grid-template-columns:1fr;">
          ${item.inputs
            .map(
              (inp) => `
            <div class="field">
              <label>${inp.label}</label>
              ${
                inp.type === "select"
                  ? `<select data-key="${inp.key}">${inp.options.map((o) => `<option value="${o}">${o}</option>`).join("")}</select>`
                  : `<input type="number" step="any" data-key="${inp.key}" value="${inp.default ?? ""}" placeholder="0" />`
              }
            </div>`
            )
            .join("")}
        </div>
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:var(--sp-4)">Hesabla</button>
      </form>
      <div class="card" data-results>
        <h3>Nəticə</h3>
        <p style="font-size:0.85rem;">Dəyərləri daxil edib "Hesabla" düyməsini basın.</p>
      </div>
    </div>
  `;

  const form = root.querySelector("[data-calc-form]");
  const resultsBox = root.querySelector("[data-results]");
  const engine = ENGINES[item.engine];

  function compute() {
    const values = {};
    form.querySelectorAll("[data-key]").forEach((el) => (values[el.dataset.key] = parseFloat(el.value) || 0));
    if (!engine) {
      resultsBox.innerHTML = `<h3>Nəticə</h3><p>Bu kalkulyator üçün mühərrik tapılmadı.</p>`;
      return;
    }
    const results = engine(values);
    resultsBox.innerHTML =
      `<h3>Nəticə</h3>` +
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3);">` +
      results
        .map(
          (r) => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--border-default);padding-bottom:var(--sp-2);">
          <span style="color:var(--text-secondary);font-size:0.88rem;">${r.label}</span>
          <span class="mono" style="font-size:1.15rem;font-weight:700;color:var(--brand);">${r.value} <span style="font-size:0.75rem;color:var(--text-secondary);">${r.unit}</span></span>
        </div>`
        )
        .join("") +
      `</div>`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    compute();
  });
  form.addEventListener("input", compute);
  compute();
}
