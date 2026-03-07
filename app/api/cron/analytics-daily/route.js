import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/server/firebaseAdmin.js";
import { runAnalyticsCronAggregation } from "../../../../lib/server/analytics.js";

export const dynamic = "force-dynamic";

function readBearer(request) {
  const auth = request.headers.get("authorization") || "";
  const parts = auth.split(" ");
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) return parts[1];
  return null;
}

function isAuthorized(request) {
  const expected = process.env.CRON_SECRET || process.env.ANALYTICS_CRON_SECRET;
  if (!expected) return false;

  const url = new URL(request.url);
  const q = url.searchParams.get("secret");
  const bearer = readBearer(request);
  const header = request.headers.get("x-cron-secret");

  return q === expected || bearer === expected || header === expected;
}

async function handleCron(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const force = new URL(request.url).searchParams.get("force") === "1";
    const result = await runAnalyticsCronAggregation(db, { force });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "cron_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request) {
  return handleCron(request);
}

export async function POST(request) {
  return handleCron(request);
}
