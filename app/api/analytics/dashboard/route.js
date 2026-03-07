import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/server/firebaseAdmin.js";
import { getAnalyticsDashboardPayload } from "../../../../lib/server/analytics.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getAdminDb();
    const payload = await getAnalyticsDashboardPayload(db);
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analytics fetch failed";
    return NextResponse.json(
      {
        error: "analytics_dashboard_failed",
        message
      },
      { status: 500 }
    );
  }
}
