import { getDocumentsDB } from "./data.js";
import { isUnlocked, purchaseItem } from "./payments.js";
import { buildDocumentPDF } from "./pdf-generator.js";

function docCardHTML(doc, categories) {
  const cat = categories.find((c) => c.id === doc.category);
  return `
  <a class="card card-hover doc-card reveal" href="document-view.html?id=${doc.id}">
    <div class="doc-card-foot" style="margin-top:0;">
      <span class="doc-code mono">${doc.code}</span>
      <span class="badge badge-premium">Premium</span>
    </div>
    <h4>${doc.title_az}</h4>
    <p class="doc-desc">${doc.description_az}</p>
    <div class="doc-card-foot">
      <span class="badge badge-category">${cat ? cat.title_az : ""}</span>
      <span style="font-size:0.8rem;color:var(--brand);font-weight:600;">Bax →</span>
    </div>
  </a>`;
}

/** Renders the searchable/filterable document grid used on documents.html and the homepage. */
export async function initDocumentsBrowser({ gridSelector, maxItems = null, showFilters = true } = {}) {
  const grid = document.querySelector(gridSelector);
  if (!grid) return;
  const db = await getDocumentsDB();
  const { categories, documents } = db;

  const params = new URLSearchParams(window.location.search);
  let activeCategory = params.get("category") || "all";
  let query = params.get("q") || "";

  const filterBar = document.querySelector("[data-filter-bar]");
  if (filterBar && showFilters) {
    filterBar.innerHTML = `
      <input type="text" placeholder="Sənəd axtar... (məs: NCR, İnsident, İcazə)" value="${query}" data-search-input />
      <select data-category-select>
        <option value="all">Bütün kateqoriyalar</option>
        ${categories.map((c) => `<option value="${c.id}">${c.title_az}</option>`).join("")}
      </select>
    `;
    filterBar.querySelector("[data-search-input]").addEventListener("input", (e) => {
      query = e.target.value;
      render();
    });
    filterBar.querySelector("[data-category-select]").value = activeCategory;
    filterBar.querySelector("[data-category-select]").addEventListener("change", (e) => {
      activeCategory = e.target.value;
      render();
    });
  }

  const countEl = document.querySelector("[data-result-count]");

  function render() {
    let list = documents.filter((d) => {
      const matchesCategory = activeCategory === "all" || d.category === activeCategory;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || d.title_az.toLowerCase().includes(q) || d.title_en.toLowerCase().includes(q) || d.code.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
    if (maxItems) list = list.slice(0, maxItems);

    grid.innerHTML = list.length
      ? list.map((d) => docCardHTML(d, categories)).join("")
      : `<p style="grid-column:1/-1;text-align:center;padding:var(--sp-8) 0;">Heç bir sənəd tapılmadı. Axtarışı dəyişməyi cəhd edin.</p>`;

    if (countEl) countEl.textContent = `${list.length} sənəd tapıldı`;

    // re-trigger reveal animation for freshly rendered cards
    grid.querySelectorAll(".reveal").forEach((el) => requestAnimationFrame(() => el.classList.add("in")));
  }

  render();
}

/** Renders category chip row (used on documents.html) wired to the same query params. */
export async function initCategoryChips(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  const { categories } = await getDocumentsDB();
  const params = new URLSearchParams(window.location.search);
  const active = params.get("category") || "all";
  el.innerHTML =
    `<button class="chip ${active === "all" ? "active" : ""}" data-cat="all">Hamısı</button>` +
    categories.map((c) => `<button class="chip ${active === c.id ? "active" : ""}" data-cat="${c.id}">${c.title_az}</button>`).join("");
  el.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    const select = document.querySelector("[data-category-select]");
    if (select) {
      select.value = btn.dataset.cat;
      select.dispatchEvent(new Event("change"));
    }
    el.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
  });
}

// -------------------------------------------------------------------------
// Single document view / generator (document-view.html)
// -------------------------------------------------------------------------

function formFieldsFor(doc) {
  const common = `
    <div class="field"><label>Şirkət</label><input type="text" data-field="company" placeholder="IndustrCons MMC" /></div>
    <div class="field"><label>Layihə</label><input type="text" data-field="project" placeholder="Layihənin adı" /></div>
    <div class="field"><label>Yer</label><input type="text" data-field="location" placeholder="Sahənin ünvanı" /></div>
    <div class="field"><label>Sifarişçi</label><input type="text" data-field="client" placeholder="Sifarişçi şirkət" /></div>
    <div class="field"><label>Tarix</label><input type="date" data-field="date" /></div>
    <div class="field"><label>Sənəd Nömrəsi</label><input type="text" data-field="docNumber" placeholder="0001" /></div>
    <div class="field"><label>Mühəndis</label><input type="text" data-field="engineer" placeholder="Ad Soyad" /></div>
    <div class="field"><label>Hazırladı</label><input type="text" data-field="preparedBy" placeholder="Ad Soyad" /></div>
    <div class="field"><label>Yoxladı</label><input type="text" data-field="checkedBy" placeholder="Ad Soyad" /></div>
    <div class="field"><label>Təsdiqlədi</label><input type="text" data-field="approvedBy" placeholder="Ad Soyad" /></div>
  `;

  if (doc.formType === "report") {
    return (
      common +
      `<div class="field field-full"><label>Baş verənlərin təsviri</label><textarea data-field="description" placeholder="Hadisənin ətraflı təsviri..."></textarea></div>
       <div class="field field-full"><label>Səbəb təhlili</label><textarea data-field="cause" placeholder="Kök səbəb..."></textarea></div>
       <div class="field field-full"><label>Görülən / görüləcək tədbirlər</label><textarea data-field="actions" placeholder="Düzəldici tədbirlər..."></textarea></div>
       <div class="field field-full"><label>Əlavə qeydlər</label><textarea data-field="notes"></textarea></div>`
    );
  }

  // checklist / permit / register / log -> item table
  return (
    common +
    `<div class="field field-full">
      <label>Bəndlər</label>
      <table class="table-editor" data-items-table>
        <thead><tr><th style="width:36px">№</th><th>Bənd / Fəaliyyət</th><th style="width:130px">Nəticə</th><th>Qeyd</th><th style="width:36px"></th></tr></thead>
        <tbody data-items-body></tbody>
      </table>
      <button type="button" class="btn btn-outline btn-sm" style="margin-top:var(--sp-2)" data-add-row>+ Bənd əlavə et</button>
    </div>
    <div class="field field-full"><label>Əlavə qeydlər</label><textarea data-field="notes"></textarea></div>`
  );
}

function addItemRow(tbody) {
  const idx = tbody.children.length + 1;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${idx}</td>
    <td><input type="text" data-item="desc" placeholder="Fəaliyyət / bənd təsviri" /></td>
    <td>
      <select data-item="status">
        <option value="Uyğun">Uyğun</option>
        <option value="Uyğun deyil">Uyğun deyil</option>
        <option value="N/A">N/A</option>
      </select>
    </td>
    <td><input type="text" data-item="remarks" placeholder="Qeyd" /></td>
    <td><button type="button" class="btn-ghost" data-remove-row title="Sil">✕</button></td>
  `;
  tr.querySelector("[data-remove-row]").addEventListener("click", () => tr.remove());
  tbody.appendChild(tr);
}

function collectFormValues(root) {
  const values = {};
  root.querySelectorAll("[data-field]").forEach((el) => (values[el.dataset.field] = el.value));
  const itemsBody = root.querySelector("[data-items-body]");
  if (itemsBody) {
    values.items = [...itemsBody.querySelectorAll("tr")].map((tr) => ({
      desc: tr.querySelector('[data-item="desc"]')?.value || "",
      status: tr.querySelector('[data-item="status"]')?.value || "",
      remarks: tr.querySelector('[data-item="remarks"]')?.value || "",
    }));
  }
  return values;
}

export async function initDocumentViewer() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const root = document.querySelector("[data-doc-viewer]");
  if (!root || !id) return;

  const { categories, documents } = await getDocumentsDB();
  const doc = documents.find((d) => d.id === id);
  if (!doc) {
    root.innerHTML = `<p>Sənəd tapılmadı.</p>`;
    return;
  }

  document.title = `${doc.title_az} — IndustrCons Docs`;
  const cat = categories.find((c) => c.id === doc.category);

  root.innerHTML = `
    <div class="section-head">
      <div>
        <span class="section-eyebrow mono">${doc.code} · ${cat ? cat.title_az : ""}</span>
        <h1 style="font-size:2rem;margin-bottom:var(--sp-2)">${doc.title_az}</h1>
        <p style="max-width:640px">${doc.description_az}</p>
      </div>
    </div>
    <div class="grid" style="grid-template-columns: 2fr 1fr; align-items:start; gap:var(--sp-6);">
      <form class="card" data-form>
        <h3 style="margin-bottom:var(--sp-4)">Sənəd Məlumatları</h3>
        <div class="form-grid">${formFieldsFor(doc)}</div>
      </form>
      <div class="card" style="position:sticky; top:90px;">
        <div class="stamp-seal" style="margin:0 auto var(--sp-4)"><span class="stamp-text">IndustrCons<br/>Təsdiq</span></div>
        <h3 style="text-align:center">${doc.premium ? "Premium Sənəd" : "Pulsuz Sənəd"}</h3>
        <p style="text-align:center;font-size:0.85rem;">Önizləmə pulsuzdur. PDF endirmək üçün sənədi açmaq lazımdır.</p>
        <button class="btn btn-outline btn-block" type="button" data-preview-btn>Önizləmə</button>
        <button class="btn btn-stamp btn-block" type="button" style="margin-top:var(--sp-3)" data-download-btn>${doc.premium ? "Aç və PDF Endir — 2 ₼" : "PDF Endir"}</button>
        <p style="font-size:0.75rem;text-align:center;margin-top:var(--sp-3);color:var(--text-secondary)">Stripe · Payriff · Kapital Bank · Lemon Squeezy dəstəklənəcək</p>
      </div>
    </div>
  `;

  const addBtn = root.querySelector("[data-add-row]");
  const itemsBody = root.querySelector("[data-items-body]");
  if (addBtn && itemsBody) {
    addItemRow(itemsBody);
    addItemRow(itemsBody);
    addBtn.addEventListener("click", () => addItemRow(itemsBody));
  }

  const form = root.querySelector("[data-form]");

  root.querySelector("[data-preview-btn]").addEventListener("click", () => {
    const values = collectFormValues(form);
    const pdf = buildDocumentPDF(doc, values);
    window.open(pdf.output("bloburl"), "_blank");
  });

  root.querySelector("[data-download-btn]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const values = collectFormValues(form);

    if (doc.premium && !isUnlocked(doc.id)) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Ödəniş işlənir...`;
      try {
        await purchaseItem({ itemId: doc.id, itemType: "document", price: 2 });
      } catch (err) {
        alert("Ödəniş baş tutmadı: " + err.message);
        btn.disabled = false;
        btn.textContent = "Aç və PDF Endir — 2 ₼";
        return;
      }
    }

    const pdf = buildDocumentPDF(doc, values);
    pdf.save(`${doc.code}-${doc.id}.pdf`);
    btn.disabled = false;
    btn.textContent = "PDF Yenidən Endir";
  });
}
