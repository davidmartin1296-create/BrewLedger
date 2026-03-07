export const OPERATIONAL_TIMEZONE = "Europe/London";

const DATE_PARTS_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: OPERATIONAL_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

function getParts(date) {
  const parts = DATE_PARTS_FORMAT.formatToParts(date);
  const valueOf = (type) => parts.find((p) => p.type === type)?.value || "00";
  return {
    year: Number(valueOf("year")),
    month: Number(valueOf("month")),
    day: Number(valueOf("day")),
    hour: Number(valueOf("hour")),
    minute: Number(valueOf("minute")),
    second: Number(valueOf("second"))
  };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function toIsoDate(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function shiftIsoDate(isoDate, deltaDays) {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof value.toDate === "function") {
    const parsed = value.toDate();
    return Number.isNaN(parsed?.getTime?.()) ? null : parsed;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getOperationalDateString(input = new Date()) {
  const date = parseDateValue(input) || new Date();
  const london = getParts(date);
  const sameDay = toIsoDate(london);
  if (london.hour >= 5) return sameDay;
  return shiftIsoDate(sameDay, -1);
}

export function ensureOperationalDate(value, fallbackDate = new Date()) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return getOperationalDateString(fallbackDate);
}

export function isLondonCronAggregationWindow(input = new Date()) {
  const date = parseDateValue(input) || new Date();
  const london = getParts(date);
  return london.hour === 5 && london.minute >= 20 && london.minute <= 45;
}

export function formatOperationalDateLabel(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  return d.toLocaleDateString("en-GB", {
    timeZone: OPERATIONAL_TIMEZONE,
    day: "numeric",
    month: "long"
  });
}

export function formatOperationalShortLabel(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  return d.toLocaleDateString("en-GB", {
    timeZone: OPERATIONAL_TIMEZONE,
    weekday: "short"
  });
}
