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
export const BAR_STORAGE_KEY = "brew_selected_bar";
export const BOARD_MODE_STORAGE_KEY = "brew_board_mode";

const BAR_KEY_MAP = new Map(
  BAR_OPTIONS.map((bar) => [bar.toLowerCase(), bar])
);

export function normalizeBar(value) {
  const raw = String(value || "").trim().toLowerCase();
  return BAR_KEY_MAP.get(raw) || null;
}

export function getSelectedBar() {
  return normalizeBar(localStorage.getItem(BAR_STORAGE_KEY));
}

export function setSelectedBar(value) {
  const bar = normalizeBar(value) || DEFAULT_BAR;
  localStorage.setItem(BAR_STORAGE_KEY, bar);
  return bar;
}

export function clearSelectedBar() {
  localStorage.removeItem(BAR_STORAGE_KEY);
}

export function barToKey(value) {
  const bar = normalizeBar(value) || DEFAULT_BAR;
  return bar.toLowerCase().replace(/\s+/g, "-");
}

export function getBarSelectUrl(nextPath) {
  const next = nextPath || window.location.pathname || "/dashboard.html";
  return `/bar-select.html?next=${encodeURIComponent(next)}`;
}

export function ensureBarOrRedirect(nextPath) {
  const bar = getSelectedBar();
  if (bar) return bar;
  window.location.href = getBarSelectUrl(nextPath);
  return null;
}

export function applyBarHeader(labelEl, switchBtnEl, currentBar) {
  if (labelEl) labelEl.textContent = `Bar: ${currentBar}`;
  if (switchBtnEl) {
    switchBtnEl.addEventListener("click", () => {
      window.location.href = getBarSelectUrl(window.location.pathname);
    });
  }
}

export function getBoardMode() {
  const raw = String(localStorage.getItem(BOARD_MODE_STORAGE_KEY) || "").trim();
  return raw === "all" ? "all" : "current";
}

export function setBoardMode(mode) {
  const next = mode === "all" ? "all" : "current";
  localStorage.setItem(BOARD_MODE_STORAGE_KEY, next);
  return next;
}
