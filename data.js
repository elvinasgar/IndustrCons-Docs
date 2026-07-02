// data.js — data access layer.
// Everything the UI needs goes through these functions. Today they read the
// static JSON "database" in (same folder). Swapping to Firebase/Supabase later
// means rewriting the bodies of these functions only — no UI code changes.

const BASE = new URL("./", import.meta.url);
const cache = new Map();

async function loadJSON(file) {
  if (cache.has(file)) return cache.get(file);
  const res = await fetch(new URL(file, BASE));
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  const json = await res.json();
  cache.set(file, json);
  return json;
}

export const getDocumentsDB = () => loadJSON("documents.json");
export const getCalculatorsDB = () => loadJSON("calculators.json");
export const getGeometryDB = () => loadJSON("geometry.json");
export const getKnowledgeDB = () => loadJSON("knowledge.json");
export const getExcelTemplatesDB = () => loadJSON("excel-templates.json");

export async function findDocument(id) {
  const db = await getDocumentsDB();
  return db.documents.find((d) => d.id === id) || null;
}

export async function findCalculator(id) {
  const db = await getCalculatorsDB();
  return db.calculators.find((c) => c.id === id) || null;
}

export async function findGeometryTool(id) {
  const db = await getGeometryDB();
  return db.tools.find((t) => t.id === id) || null;
}

export function categoryLabel(categories, id) {
  const c = categories.find((c) => c.id === id);
  return c ? c.title_az : id;
}
