import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { DEFAULT_BAR, normalizeBar, barToKey } from "./barContext.js";

const MARKER_COLLECTION = "system";
const MARKER_DOC = "migrations";
const MARKER_KEY = "bar_v1";
const BATCH_LIMIT = 400;

function nowIso() {
  return new Date().toISOString();
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mappedStatus(task) {
  const raw = String(task.status || "").trim().toLowerCase();
  const neededQty = Math.max(0, toNum(task.neededQty, 0));
  const collectedQty = Math.max(0, toNum(task.replacedQty, 0));
  const outstandingQty = Math.max(0, toNum(task.outstandingQty, neededQty - collectedQty));

  if (raw === "requested" || raw === "collected" || raw === "completed") return raw;
  if (raw === "active") return collectedQty > 0 ? "collected" : "requested";
  if (raw === "complete") return "collected";
  if (raw === "closed") return "completed";
  if (outstandingQty <= 0) return "collected";
  return collectedQty > 0 ? "collected" : "requested";
}

async function commitBuffered(db, updates) {
  if (!updates.length) return;
  let index = 0;
  while (index < updates.length) {
    const batch = writeBatch(db);
    const chunk = updates.slice(index, index + BATCH_LIMIT);
    chunk.forEach((item) => batch.update(item.ref, item.data));
    await batch.commit();
    index += BATCH_LIMIT;
  }
}

async function migrateDrinks(db) {
  const snap = await getDocs(collection(db, "drinks"));
  const updates = [];
  snap.forEach((row) => {
    const d = row.data() || {};
    const bar = normalizeBar(d.bar) || DEFAULT_BAR;
    if (d.bar !== bar) {
      updates.push({
        ref: row.ref,
        data: {
          bar,
          updatedAt: nowIso()
        }
      });
    }
  });
  await commitBuffered(db, updates);
}

async function migrateInventory(db) {
  const snap = await getDocs(collection(db, "inventory"));
  const updates = [];
  snap.forEach((row) => {
    const d = row.data() || {};
    const bar = normalizeBar(d.bar) || DEFAULT_BAR;
    if (d.bar !== bar) {
      updates.push({
        ref: row.ref,
        data: {
          bar,
          updatedAt: nowIso()
        }
      });
    }
  });
  await commitBuffered(db, updates);
}

async function migrateRestockTasks(db) {
  const snap = await getDocs(collection(db, "restock_tasks"));
  const updates = [];
  snap.forEach((row) => {
    const d = row.data() || {};
    const bar = normalizeBar(d.bar) || DEFAULT_BAR;
    const status = mappedStatus(d);
    const neededQty = Math.max(0, toNum(d.neededQty, 0));
    const collectedQty = Math.max(0, toNum(d.replacedQty, 0));
    const outstandingQty = Math.max(0, toNum(d.outstandingQty, neededQty - collectedQty));
    const changed =
      d.bar !== bar ||
      d.status !== status ||
      toNum(d.neededQty, 0) !== neededQty ||
      toNum(d.replacedQty, 0) !== collectedQty ||
      toNum(d.outstandingQty, 0) !== outstandingQty;
    if (!changed) return;

    updates.push({
      ref: row.ref,
      data: {
        bar,
        status,
        neededQty,
        replacedQty: collectedQty,
        outstandingQty,
        updatedAt: nowIso()
      }
    });
  });
  await commitBuffered(db, updates);
}

async function migrateSessions(db) {
  const currentRef = doc(db, "sessions", "current");
  const stageRef = doc(db, "sessions", barToKey(DEFAULT_BAR));
  const [currentSnap, stageSnap] = await Promise.all([getDoc(currentRef), getDoc(stageRef)]);

  if (currentSnap.exists() && !stageSnap.exists()) {
    await setDoc(stageRef, currentSnap.data());
  }
}

export async function ensureBarMigration(db) {
  const markerRef = doc(db, MARKER_COLLECTION, MARKER_DOC);
  const markerSnap = await getDoc(markerRef);
  const markerData = markerSnap.exists() ? markerSnap.data() : {};
  if (markerData?.[MARKER_KEY]?.completedAt) return;

  await migrateDrinks(db);
  await migrateInventory(db);
  await migrateRestockTasks(db);
  await migrateSessions(db);

  await setDoc(
    markerRef,
    {
      [MARKER_KEY]: {
        completedAt: nowIso(),
        version: 1,
        defaultBar: DEFAULT_BAR
      }
    },
    { merge: true }
  );
}
