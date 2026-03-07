import { DEFAULT_BAR, BAR_OPTIONS, normalizeBar } from "../shared/bars.js";
import {
  ensureOperationalDate,
  formatOperationalDateLabel,
  formatOperationalShortLabel,
  getOperationalDateString,
  isLondonCronAggregationWindow,
  parseDateValue,
  shiftIsoDate
} from "../../data/operationalDay.js";

const MIGRATION_MARKER_FIELD = "analytics_v1";
const CRON_MARKER_FIELD = "analytics_daily";
const BATCH_LIMIT = 400;

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(rawStatus, neededQty, collectedQty, outstandingQty) {
  const raw = String(rawStatus || "").trim().toLowerCase();
  if (raw === "requested" || raw === "collected" || raw === "completed") return raw;
  if (raw === "active") return collectedQty > 0 ? "collected" : "requested";
  if (raw === "complete") return "collected";
  if (raw === "closed") return "completed";
  if (outstandingQty <= 0) return "collected";
  return collectedQty > 0 ? "collected" : "requested";
}

export function getTaskItemName(task) {
  return String(task?.itemName || task?.drinkName || "").trim();
}

export function getTaskNeededQty(task) {
  const quantity = Math.max(0, toNum(task?.quantity, 0));
  const neededQty = Math.max(0, toNum(task?.neededQty, quantity));
  return neededQty > 0 ? neededQty : quantity;
}

export function getTaskCollectedQty(task) {
  return Math.max(0, toNum(task?.replacedQty, 0));
}

export function getTaskOutstandingQty(task, neededQty = getTaskNeededQty(task), collectedQty = getTaskCollectedQty(task)) {
  return Math.max(0, toNum(task?.outstandingQty, neededQty - collectedQty));
}

export function normalizeTaskStatus(task) {
  const neededQty = getTaskNeededQty(task);
  const collectedQty = getTaskCollectedQty(task);
  const outstandingQty = getTaskOutstandingQty(task, neededQty, collectedQty);
  return normalizeStatus(task?.status, neededQty, collectedQty, outstandingQty);
}

function normalizeCountMap(value) {
  const out = {};
  if (!value || typeof value !== "object") return out;
  Object.entries(value).forEach(([k, v]) => {
    if (!k) return;
    const qty = Math.max(0, toNum(v, 0));
    if (!qty) return;
    out[k] = qty;
  });
  return out;
}

function sortObjectKeys(obj) {
  const sorted = Object.keys(obj)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
  return sorted;
}

function addToMap(map, key, delta) {
  if (!key) return;
  const prev = map[key] || 0;
  map[key] = prev + delta;
}

function normalizeEvent(data) {
  const itemName = String(data?.itemName || data?.drinkName || "").trim();
  const quantity = Math.max(0, toNum(data?.quantity, 0));
  const bar = normalizeBar(data?.bar) || DEFAULT_BAR;
  const createdAt = parseDateValue(data?.createdAt) || new Date();
  const operationalDate = ensureOperationalDate(data?.operationalDate, createdAt);
  const status = normalizeStatus(data?.status, quantity, 0, quantity);

  if (!itemName || quantity <= 0) return null;

  return {
    requestId: String(data?.requestId || "").trim() || null,
    itemName,
    quantity,
    bar,
    status,
    createdAt: createdAt.toISOString(),
    operationalDate
  };
}

function summarizeEvents(events, operationalDate) {
  const bars = {};
  const barRequestCounts = {};
  const items = {};
  let totalRequests = 0;
  let totalItems = 0;

  events.forEach((event) => {
    const normalized = normalizeEvent(event);
    if (!normalized) return;
    if (operationalDate && normalized.operationalDate !== operationalDate) return;

    totalRequests += 1;
    totalItems += normalized.quantity;

    addToMap(bars, normalized.bar, normalized.quantity);
    addToMap(barRequestCounts, normalized.bar, 1);
    addToMap(items, normalized.itemName, normalized.quantity);
  });

  return {
    totalRequests,
    totalItems,
    bars: sortObjectKeys(bars),
    barRequestCounts: sortObjectKeys(barRequestCounts),
    items: sortObjectKeys(items)
  };
}

function buildDailyAggregateDoc(operationalDate, summary) {
  return {
    operationalDate,
    totalRequests: Math.max(0, toNum(summary?.totalRequests, 0)),
    totalItems: Math.max(0, toNum(summary?.totalItems, 0)),
    bars: normalizeCountMap(summary?.bars),
    barRequestCounts: normalizeCountMap(summary?.barRequestCounts),
    items: normalizeCountMap(summary?.items),
    updatedAt: nowIso()
  };
}

function trailingDates(endDate, count) {
  const dates = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    dates.push(shiftIsoDate(endDate, -i));
  }
  return dates;
}

async function commitWrites(db, writes) {
  if (!writes.length) return;
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_LIMIT).forEach((w) => {
      if (w.type === "update") {
        batch.update(w.ref, w.data);
      } else {
        batch.set(w.ref, w.data, w.options || {});
      }
    });
    await batch.commit();
  }
}

async function getAllEvents(db) {
  const snap = await db.collection("stockRequestEvents").get();
  const events = [];
  snap.forEach((row) => {
    const event = normalizeEvent(row.data() || {});
    if (event) events.push(event);
  });
  return events;
}

async function seedEventsFromTasks(db) {
  const [tasksSnap, eventsSnap] = await Promise.all([
    db.collection("restock_tasks").get(),
    db.collection("stockRequestEvents").get()
  ]);

  const requestIdsWithEvents = new Set();
  const currentEvents = [];
  eventsSnap.forEach((row) => {
    const event = normalizeEvent(row.data() || {});
    if (event) {
      currentEvents.push(event);
      if (event.requestId) requestIdsWithEvents.add(event.requestId);
    }
  });

  const writes = [];
  const seededEvents = [];
  const now = nowIso();

  tasksSnap.forEach((row) => {
    const task = row.data() || {};
    const taskId = row.id;

    const itemName = getTaskItemName(task);
    const bar = normalizeBar(task?.bar) || DEFAULT_BAR;
    const createdAt = parseDateValue(task?.createdAt) || new Date();
    const operationalDate = ensureOperationalDate(task?.operationalDate, createdAt);
    const neededQty = getTaskNeededQty(task);
    const collectedQty = getTaskCollectedQty(task);
    const outstandingQty = getTaskOutstandingQty(task, neededQty, collectedQty);
    const status = normalizeStatus(task?.status, neededQty, collectedQty, outstandingQty);

    const patch = {};
    if (itemName && task.itemName !== itemName) patch.itemName = itemName;
    if (task.bar !== bar) patch.bar = bar;
    if (task.operationalDate !== operationalDate) patch.operationalDate = operationalDate;
    if (task.status !== status) patch.status = status;

    if (Object.keys(patch).length) {
      patch.updatedAt = now;
      writes.push({ type: "update", ref: row.ref, data: patch });
    }

    if (requestIdsWithEvents.has(taskId)) return;

    const seedEvent = normalizeEvent({
      requestId: taskId,
      itemName,
      quantity: neededQty,
      bar,
      status,
      createdAt,
      operationalDate
    });

    if (!seedEvent) return;

    const seedRef = db.collection("stockRequestEvents").doc(`seed_${taskId}`);
    writes.push({ type: "set", ref: seedRef, data: seedEvent, options: { merge: true } });
    seededEvents.push(seedEvent);
    requestIdsWithEvents.add(taskId);
  });

  await commitWrites(db, writes);

  return {
    seededEvents,
    allEvents: currentEvents.concat(seededEvents)
  };
}

async function writeDailyAggregates(db, dailyDocs) {
  const writes = Object.entries(dailyDocs).map(([operationalDate, summary]) => ({
    type: "set",
    ref: db.collection("analyticsDaily").doc(operationalDate),
    data: buildDailyAggregateDoc(operationalDate, summary)
  }));
  await commitWrites(db, writes);
}

function groupEventsByOperationalDate(events) {
  const grouped = {};
  events.forEach((event) => {
    const normalized = normalizeEvent(event);
    if (!normalized) return;
    if (!grouped[normalized.operationalDate]) grouped[normalized.operationalDate] = [];
    grouped[normalized.operationalDate].push(normalized);
  });
  return grouped;
}

export async function ensureAnalyticsBackfill(db) {
  const markerRef = db.collection("system").doc("migrations");
  const markerSnap = await markerRef.get();
  const marker = markerSnap.data()?.[MIGRATION_MARKER_FIELD];
  if (marker?.completedAt) {
    return { alreadyCompleted: true, seededEvents: 0 };
  }

  const seeded = await seedEventsFromTasks(db);
  const grouped = groupEventsByOperationalDate(seeded.allEvents);
  const dailyDocs = {};
  Object.entries(grouped).forEach(([operationalDate, events]) => {
    dailyDocs[operationalDate] = summarizeEvents(events, operationalDate);
  });

  await writeDailyAggregates(db, dailyDocs);

  await markerRef.set(
    {
      [MIGRATION_MARKER_FIELD]: {
        completedAt: nowIso(),
        seededEvents: seeded.seededEvents.length,
        version: 1
      }
    },
    { merge: true }
  );

  return { alreadyCompleted: false, seededEvents: seeded.seededEvents.length };
}

export async function aggregateDailyForOperationalDate(db, operationalDate) {
  const eventsSnap = await db
    .collection("stockRequestEvents")
    .where("operationalDate", "==", operationalDate)
    .get();

  const events = [];
  eventsSnap.forEach((row) => events.push(row.data() || {}));
  const summary = summarizeEvents(events, operationalDate);
  const doc = buildDailyAggregateDoc(operationalDate, summary);

  await db.collection("analyticsDaily").doc(operationalDate).set(doc, { merge: true });

  return doc;
}

export async function runAnalyticsCronAggregation(db, options = {}) {
  const force = options.force === true;
  await ensureAnalyticsBackfill(db);

  const now = new Date();
  const inWindow = isLondonCronAggregationWindow(now);
  if (!force && !inWindow) {
    return {
      ran: false,
      reason: "outside_operational_window",
      now: now.toISOString()
    };
  }

  const currentOperationalDate = getOperationalDateString(now);
  const targetOperationalDate = shiftIsoDate(currentOperationalDate, -1);

  const markerRef = db.collection("system").doc("cron_markers");
  const markerSnap = await markerRef.get();
  const marker = markerSnap.data()?.[CRON_MARKER_FIELD];

  if (!force && marker?.lastOperationalDate === targetOperationalDate) {
    return {
      ran: false,
      reason: "already_aggregated",
      targetOperationalDate,
      lastRunAt: marker?.lastRunAt || null
    };
  }

  const aggregated = await aggregateDailyForOperationalDate(db, targetOperationalDate);

  await markerRef.set(
    {
      [CRON_MARKER_FIELD]: {
        lastOperationalDate: targetOperationalDate,
        lastRunAt: nowIso(),
        totalItems: aggregated.totalItems,
        totalRequests: aggregated.totalRequests
      }
    },
    { merge: true }
  );

  return {
    ran: true,
    targetOperationalDate,
    totalItems: aggregated.totalItems,
    totalRequests: aggregated.totalRequests
  };
}

async function getCurrentOperationalSummary(db, operationalDate) {
  const eventsSnap = await db
    .collection("stockRequestEvents")
    .where("operationalDate", "==", operationalDate)
    .get();

  const events = [];
  eventsSnap.forEach((row) => events.push(row.data() || {}));
  return summarizeEvents(events, operationalDate);
}

function normalizeDailyDoc(data) {
  const operationalDate = ensureOperationalDate(data?.operationalDate, new Date());
  return {
    operationalDate,
    totalRequests: Math.max(0, toNum(data?.totalRequests, 0)),
    totalItems: Math.max(0, toNum(data?.totalItems, 0)),
    bars: normalizeCountMap(data?.bars),
    barRequestCounts: normalizeCountMap(data?.barRequestCounts),
    items: normalizeCountMap(data?.items)
  };
}

function combineBarMetrics(dailyDocs) {
  const barTotals = {};
  const barRequestTotals = {};

  dailyDocs.forEach((doc) => {
    Object.entries(doc.bars || {}).forEach(([bar, items]) => addToMap(barTotals, bar, items));
    Object.entries(doc.barRequestCounts || {}).forEach(([bar, count]) => addToMap(barRequestTotals, bar, count));
  });

  return BAR_OPTIONS.map((bar) => ({
    bar,
    itemCount: Math.max(0, toNum(barTotals[bar], 0)),
    requestCount: Math.max(0, toNum(barRequestTotals[bar], 0))
  })).sort((a, b) => b.itemCount - a.itemCount || b.requestCount - a.requestCount || a.bar.localeCompare(b.bar));
}

function combineTopItems(dailyDocs) {
  const totals = {};
  dailyDocs.forEach((doc) => {
    Object.entries(doc.items || {}).forEach(([itemName, qty]) => addToMap(totals, itemName, qty));
  });

  return Object.entries(totals)
    .map(([itemName, quantity]) => ({ itemName, quantity: Math.max(0, toNum(quantity, 0)) }))
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.itemName.localeCompare(b.itemName));
}

function combineBarDemand(dailyDocs) {
  const totals = {};
  dailyDocs.forEach((doc) => {
    Object.entries(doc.bars || {}).forEach(([bar, qty]) => addToMap(totals, bar, qty));
  });

  return BAR_OPTIONS.map((bar) => ({
    bar,
    quantity: Math.max(0, toNum(totals[bar], 0))
  }))
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.bar.localeCompare(b.bar));
}

function buildWeeklyTrend(dates7, dayMap) {
  return dates7.map((operationalDate) => {
    const day = dayMap.get(operationalDate) || {
      totalItems: 0,
      totalRequests: 0
    };

    return {
      operationalDate,
      label: formatOperationalShortLabel(operationalDate),
      totalItems: Math.max(0, toNum(day.totalItems, 0)),
      totalRequests: Math.max(0, toNum(day.totalRequests, 0))
    };
  });
}

async function getOutstandingByBar(db) {
  const tasksSnap = await db.collection("restock_tasks").get();
  const grouped = new Map(BAR_OPTIONS.map((bar) => [bar, []]));

  tasksSnap.forEach((row) => {
    const task = row.data() || {};
    const status = normalizeTaskStatus(task);
    if (status === "completed") return;

    const bar = normalizeBar(task?.bar) || DEFAULT_BAR;
    const itemName = getTaskItemName(task) || "Unnamed item";
    const neededQty = getTaskNeededQty(task);
    const collectedQty = getTaskCollectedQty(task);
    const outstandingQty = getTaskOutstandingQty(task, neededQty, collectedQty);

    if (outstandingQty <= 0) return;

    grouped.get(bar).push({
      requestId: row.id,
      itemName,
      neededQty,
      collectedQty,
      outstandingQty,
      status,
      createdAt: parseDateValue(task?.createdAt)?.toISOString?.() || null,
      operationalDate: ensureOperationalDate(task?.operationalDate, task?.createdAt)
    });
  });

  return BAR_OPTIONS.map((bar) => {
    const items = grouped.get(bar) || [];
    items.sort((a, b) => b.outstandingQty - a.outstandingQty || a.itemName.localeCompare(b.itemName));
    return {
      bar,
      totalOutstandingItems: items.reduce((sum, row) => sum + row.outstandingQty, 0),
      requestCount: items.length,
      items
    };
  }).filter((group) => group.items.length > 0);
}

export async function getAnalyticsDashboardPayload(db) {
  await ensureAnalyticsBackfill(db);

  const currentOperationalDate = getOperationalDateString();
  const start30 = shiftIsoDate(currentOperationalDate, -29);

  const [currentDaySummary, dailySnap, outstandingByBar] = await Promise.all([
    getCurrentOperationalSummary(db, currentOperationalDate),
    db
      .collection("analyticsDaily")
      .where("operationalDate", ">=", start30)
      .where("operationalDate", "<=", currentOperationalDate)
      .orderBy("operationalDate", "asc")
      .get(),
    getOutstandingByBar(db)
  ]);

  const dayMap = new Map();
  dailySnap.forEach((row) => {
    const normalized = normalizeDailyDoc(row.data() || {});
    dayMap.set(normalized.operationalDate, normalized);
  });

  // Keep the current operational day live from events (can be ahead of nightly aggregate).
  dayMap.set(
    currentOperationalDate,
    normalizeDailyDoc({ operationalDate: currentOperationalDate, ...currentDaySummary })
  );

  const dates7 = trailingDates(currentOperationalDate, 7);
  const dates30 = trailingDates(currentOperationalDate, 30);

  const docs7 = dates7.map((date) => dayMap.get(date) || normalizeDailyDoc({ operationalDate: date }));
  const docs30 = dates30.map((date) => dayMap.get(date) || normalizeDailyDoc({ operationalDate: date }));

  const operationalBars = BAR_OPTIONS.map((bar) => ({
    bar,
    items: Math.max(0, toNum(currentDaySummary.bars?.[bar], 0)),
    requests: Math.max(0, toNum(currentDaySummary.barRequestCounts?.[bar], 0))
  }));

  return {
    generatedAt: nowIso(),
    timezone: "Europe/London",
    operationalDaySummary: {
      operationalDate: currentOperationalDate,
      label: formatOperationalDateLabel(currentOperationalDate),
      totalRequests: currentDaySummary.totalRequests,
      totalItems: currentDaySummary.totalItems,
      barsActive: operationalBars.filter((row) => row.items > 0).length,
      bars: operationalBars
    },
    barUsage7d: combineBarMetrics(docs7),
    topItems7d: combineTopItems(docs7).slice(0, 20),
    weeklyTrend7d: buildWeeklyTrend(dates7, dayMap),
    barDemand30d: combineBarDemand(docs30),
    outstandingByBar
  };
}
