"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import styles from "./analytics.module.css";
import { BAR_OPTIONS, DEFAULT_BAR, normalizeBar } from "../../lib/shared/bars.js";

function fmt(value) {
  return Number(value || 0).toLocaleString("en-GB");
}

function barSelectUrl() {
  return `/bar-select.html?next=${encodeURIComponent("/analytics")}`;
}

function noData(data) {
  return !Array.isArray(data) || data.length === 0;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: "rgba(18,16,14,0.95)",
        border: "1px solid rgba(212,154,93,0.35)",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((row) => (
        <div key={row.name} style={{ color: row.color }}>
          {row.name}: {fmt(row.value)}
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [currentBar, setCurrentBar] = useState(DEFAULT_BAR);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (typeof window === "undefined") return;

      if (localStorage.getItem("brew_access_granted") !== "1") {
        window.location.href = "/login.html";
        return;
      }

      const storedBar = normalizeBar(localStorage.getItem("brew_selected_bar"));
      if (!storedBar) {
        window.location.href = barSelectUrl();
        return;
      }

      setCurrentBar(storedBar);

      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/analytics/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const payload = await res.json();
        if (!cancelled) setDashboard(payload);
      } catch {
        if (!cancelled) setError("Could not load analytics right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const operationalBars = useMemo(() => {
    const rows = Array.isArray(dashboard?.operationalDaySummary?.bars)
      ? dashboard.operationalDaySummary.bars
      : [];
    const byBar = new Map(rows.map((row) => [row.bar, row]));
    return BAR_OPTIONS.map((bar) => ({
      bar,
      items: Number(byBar.get(bar)?.items || 0)
    }));
  }, [dashboard]);

  const barUsage7d = useMemo(() => {
    const rows = Array.isArray(dashboard?.barUsage7d) ? dashboard.barUsage7d : [];
    if (!rows.length) return [];
    return rows.map((row) => ({
      bar: row.bar,
      "Items": Number(row.itemCount || 0),
      "Requests": Number(row.requestCount || 0)
    }));
  }, [dashboard]);

  const topItems = useMemo(() => {
    const rows = Array.isArray(dashboard?.topItems7d) ? dashboard.topItems7d : [];
    return rows.slice(0, 8).map((row) => ({
      itemName: row.itemName,
      quantity: Number(row.quantity || 0)
    }));
  }, [dashboard]);

  const weeklyTrend = useMemo(() => {
    const rows = Array.isArray(dashboard?.weeklyTrend7d) ? dashboard.weeklyTrend7d : [];
    return rows.map((row) => ({
      label: row.label,
      "Items": Number(row.totalItems || 0),
      "Requests": Number(row.totalRequests || 0)
    }));
  }, [dashboard]);

  const barDemand30d = useMemo(() => {
    const rows = Array.isArray(dashboard?.barDemand30d) ? dashboard.barDemand30d : [];
    return rows.map((row) => ({
      bar: row.bar,
      quantity: Number(row.quantity || 0)
    }));
  }, [dashboard]);

  const outstanding = useMemo(() => {
    return Array.isArray(dashboard?.outstandingByBar) ? dashboard.outstandingByBar : [];
  }, [dashboard]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <img className={styles.logo} src="/images/B-Logo.png" alt="Brew-Ledger" />
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.subtitle}>Usage insights across all bars</p>
        </div>
        <div className={styles.barTools}>
          <div className={styles.barPill}>Bar: {currentBar}</div>
          <a className={styles.barSwitch} href={barSelectUrl()}>
            Switch
          </a>
        </div>
      </header>

      <main className={styles.main}>
        {loading ? <section className={`${styles.card} panel`}><div className={styles.loading}>Loading analytics…</div></section> : null}
        {!loading && error ? <section className={`${styles.card} panel`}><div className={styles.error}>{error}</div></section> : null}

        {!loading && !error ? (
          <>
            <section className={`${styles.card} panel`}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Operational Day Summary</h2>
                <span className={styles.cardMeta}>{dashboard?.operationalDaySummary?.label || "—"}</span>
              </div>

              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Total Requests</div>
                  <div className={styles.summaryValue}>{fmt(dashboard?.operationalDaySummary?.totalRequests)}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Total Items</div>
                  <div className={styles.summaryValue}>{fmt(dashboard?.operationalDaySummary?.totalItems)}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Bars Active</div>
                  <div className={styles.summaryValue}>{fmt(dashboard?.operationalDaySummary?.barsActive)}</div>
                </div>
              </div>

              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operationalBars} layout="vertical" margin={{ left: 6, right: 12, top: 6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis type="number" stroke="rgba(245,243,239,0.6)" />
                    <YAxis dataKey="bar" type="category" width={64} stroke="rgba(245,243,239,0.6)" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="items" name="Items" fill="#d49a5d" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className={styles.grid2}>
              <div className={`${styles.card} panel`}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Bar Usage (Last 7 Days)</h2>
                </div>

                {noData(barUsage7d) ? (
                  <div className={styles.empty}>No usage yet.</div>
                ) : (
                  <>
                    <div className={styles.chartWrap}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barUsage7d} margin={{ left: 6, right: 8, top: 8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                          <XAxis dataKey="bar" stroke="rgba(245,243,239,0.6)" />
                          <YAxis stroke="rgba(245,243,239,0.6)" allowDecimals={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="Items" fill="#d49a5d" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="Requests" fill="#86efac" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>

              <div className={`${styles.card} panel`}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Top Requested Items (Last 7 Days)</h2>
                </div>

                {noData(topItems) ? (
                  <div className={styles.empty}>No items requested yet.</div>
                ) : (
                  <>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topItems.slice(0, 5).map((row) => (
                          <tr key={row.itemName}>
                            <td>{row.itemName}</td>
                            <td>{fmt(row.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className={styles.chartWrap}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topItems} layout="vertical" margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                          <XAxis type="number" stroke="rgba(245,243,239,0.6)" />
                          <YAxis dataKey="itemName" type="category" width={110} stroke="rgba(245,243,239,0.6)" />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="quantity" name="Quantity" fill="#fcd34d" radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className={styles.grid2}>
              <div className={`${styles.card} panel`}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Weekly Trends</h2>
                </div>

                {noData(weeklyTrend) ? (
                  <div className={styles.empty}>No weekly trend data yet.</div>
                ) : (
                  <div className={styles.chartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyTrend} margin={{ left: 6, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                        <XAxis dataKey="label" stroke="rgba(245,243,239,0.6)" />
                        <YAxis stroke="rgba(245,243,239,0.6)" allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line type="monotone" dataKey="Items" stroke="#d49a5d" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Requests" stroke="#86efac" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={`${styles.card} panel`}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Bar Demand Trends (Last 30 Days)</h2>
                </div>

                {noData(barDemand30d) ? (
                  <div className={styles.empty}>No 30-day demand data yet.</div>
                ) : (
                  <div className={styles.chartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barDemand30d} layout="vertical" margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                        <XAxis type="number" stroke="rgba(245,243,239,0.6)" />
                        <YAxis dataKey="bar" type="category" width={64} stroke="rgba(245,243,239,0.6)" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="quantity" name="Items" fill="#d49a5d" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </section>

            <section className={`${styles.card} panel`}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Outstanding Requests</h2>
                <span className={styles.cardMeta}>Status: not completed</span>
              </div>

              {noData(outstanding) ? (
                <div className={styles.empty}>No outstanding requests right now.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {outstanding.map((group) => (
                    <article className={styles.outstandingGroup} key={group.bar}>
                      <div className={styles.outstandingHead}>
                        <h3 className={styles.outstandingBar}>{group.bar}</h3>
                        <span className={styles.outstandingMeta}>
                          {fmt(group.requestCount)} requests · {fmt(group.totalOutstandingItems)} items
                        </span>
                      </div>
                      {group.items.map((item) => (
                        <div key={item.requestId} className={styles.outstandingItem}>
                          <span>{item.itemName}</span>
                          <span className={styles.outstandingQty}>x{fmt(item.outstandingQty)}</span>
                        </div>
                      ))}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>

      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link className={styles.navTab} href="/dashboard.html">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Board
          </Link>
          <Link className={styles.navTab} href="/record.html">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Record
          </Link>
          <Link className={styles.navTab} href="/drinks.html">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Drinks
          </Link>
          <Link className={styles.navTab} href="/summary.html">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Summary
          </Link>
          <Link className={`${styles.navTab} ${styles.navTabActive}`} href="/analytics">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="6" y="13" width="3" height="5"/><rect x="11" y="9" width="3" height="9"/><rect x="16" y="6" width="3" height="12"/></svg>
            Analytics
          </Link>
          <Link className={styles.navTab} href="/settings.html">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Settings
          </Link>
        </div>
      </nav>
    </div>
  );
}
