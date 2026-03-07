export const BAR_OPTIONS = [
  "Stage",
  "Side",
  "Green",
  "Boudoir",
  "Bothy",
  "Caffe",
  "Taproom"
];

export const DEFAULT_BAR = "Stage";

const BAR_MAP = new Map(BAR_OPTIONS.map((bar) => [bar.toLowerCase(), bar]));

export function normalizeBar(value) {
  const raw = String(value || "").trim().toLowerCase();
  return BAR_MAP.get(raw) || null;
}
