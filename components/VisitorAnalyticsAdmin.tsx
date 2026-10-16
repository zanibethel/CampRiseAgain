"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Totals = { visitors: number; pageviews: number };
type Day = Totals & { date: string };
type Page = Totals & { path: string };
type Referrer = Totals & { source: string };
type Report = {
  source: string;
  periodDays: number;
  updatedAt: string;
  totals: Totals;
  daily: Day[];
  pages: Page[];
  referrers: Referrer[];
};
type ApiError = { code?: string; error?: string };

const numberFormat = new Intl.NumberFormat("en-US");

function readableDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });
}

function VisitTrend({ rows }: { rows: Day[] }) {
  const max = Math.max(1, ...rows.map((row) => row.visitors));
  if (!rows.length) return <p className="section-copy">A daily traffic trend will appear as more visits are recorded.</p>;
  return (
    <div className="visitor-trend" role="img" aria-label={`Daily visitors: ${rows.map((d) => `${readableDate(d.date)}: ${d.visitors}`).join(", ")}`}>
      {rows.map((row) => (
        <div className="visitor-trend-item" key={row.date} title={`${readableDate(row.date)}: ${row.visitors} visitors, ${row.pageviews} page views`}>
          <span className="visitor-trend-number">{row.visitors}</span>
          <span className="visitor-trend-track"><span className="visitor-trend-bar" style={{ height: row.visitors ? `${Math.max(7, (row.visitors / max) * 100)}%` : "0%" }} /></span>
          <span className="visitor-trend-day">{readableDate(row.date)}</span>
        </div>
      ))}
    </div>
  );
}

export default function VisitorAnalyticsAdmin() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal, initial = false) => {
    if (!supabase || (typeof document !== "undefined" && document.hidden && !initial)) return;
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error("Your admin session has expired. Please sign in again.");
      const response = await fetch(`/api/admin/visitor-analytics?days=${period}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
        signal,
      });
      const result: Report | ApiError = await response.json();
      if (!response.ok) {
        const err = result as ApiError;
        if (!signal?.aborted) { setError({ error: err.error || "Could not load visitor analytics.", code: err.code }); setReport(null); }
        return;
      }
      if (!signal?.aborted) {
        setReport(result as Report);
        setError(null);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError({ error: err instanceof Error ? err.message : "Could not load visitor analytics." });
        setReport(null);
      }
    } finally {
      if (!signal?.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [period, supabase]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal, true);
    const interval = window.setInterval(() => void refresh(controller.signal), 60_000);
    const visibility = () => { if (!document.hidden) void refresh(controller.signal); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh]);

  return (
    <section className="form-card visitor-admin" aria-labelledby="visitor-dashboard-title">
      <div className="visitor-admin-heading">
        <div>
          <div className="eyebrow">Private admin report</div>
          <h2 id="visitor-dashboard-title">Site Visitor Analytics</h2>
          <p className="section-copy">Privacy-friendly traffic counts from Vercel, updated automatically about every minute. These are recent statistics, not a count of people currently online.</p>
        </div>
        <div className="visitor-admin-actions">
          <select aria-label="Reporting period" value={period} onChange={(event) => setPeriod(event.target.value === "30" ? 30 : 7)}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button className="btn btn-secondary" type="button" disabled={loading || refreshing} onClick={() => void refresh()}>{refreshing ? "Refreshing…" : "↻ Refresh"}</button>
        </div>
      </div>

      {loading ? (
        <p className="notice" role="status">Loading visitor statistics…</p>
      ) : error ? (
        <div className="notice visitor-admin-status" role="status">
          <strong>{error.code === "needs_setup" ? "One secure connection step remains" : "Visitor data unavailable"}</strong>
          <p>{error.error}</p>
          {error.code === "needs_setup" && <p>The site owner needs to add a Vercel access token to the project&apos;s server environment under the name <code>VERCEL_ANALYTICS_READ_TOKEN</code> and redeploy. The token must never be pasted into this page or sent in chat.</p>}
          <p className="visitor-admin-links">
            <a href="https://vercel.com/zanibethels-projects/camp-rise-again/analytics" target="_blank" rel="noreferrer">Open Vercel Analytics ↗</a>
            {error.code === "needs_setup" && <a href="https://vercel.com/zanibethels-projects/camp-rise-again/settings/environment-variables" target="_blank" rel="noreferrer">Project environment settings ↗</a>}
          </p>
        </div>
      ) : report ? (
        <>
          <div className="visitor-admin-metrics">
            <div className="visitor-admin-metric">
              <span>Visitors</span>
              <strong>{numberFormat.format(report.totals.visitors)}</strong>
            </div>
            <div className="visitor-admin-metric">
              <span>Page views</span>
              <strong>{numberFormat.format(report.totals.pageviews)}</strong>
            </div>
          </div>

          <div className="visitor-admin-section">
            <h3>Visitor trend</h3>
            <VisitTrend rows={report.daily} />
          </div>

          <div className="visitor-admin-sections">
            <section className="visitor-admin-section" aria-labelledby="popular-pages-heading">
              <h3 id="popular-pages-heading">Popular pages</h3>
              {report.pages.length ? (
                <ul className="visitor-admin-ranking">
                  {report.pages.map((page) => (
                    <li key={page.path}><span title={page.path}>{page.path === "/" ? "Homepage" : page.path === "/michael-garza" ? "Michael's Story" : page.path}</span><strong>{numberFormat.format(page.visitors)} <small>visitors</small></strong></li>
                  ))}
                </ul>
              ) : <p className="section-copy">No page breakdown available yet.</p>}
            </section>

            <section className="visitor-admin-section" aria-labelledby="visitor-referrers-heading">
              <h3 id="visitor-referrers-heading">Where visitors came from</h3>
              {report.referrers.length ? (
                <ul className="visitor-admin-ranking">
                  {report.referrers.map((item) => (
                    <li key={item.source}><span title={item.source}>{item.source}</span><strong>{numberFormat.format(item.visitors)} <small>visitors</small></strong></li>
                  ))}
                </ul>
              ) : <p className="section-copy">Referral sources will appear as visits are recorded.</p>}
            </section>
          </div>
          <p className="visitor-admin-footer">Source: {report.source} · Updated {new Date(report.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · Visitor counts are approximate and privacy-protected. <a href="https://vercel.com/zanibethels-projects/camp-rise-again/analytics" target="_blank" rel="noreferrer">Detailed report ↗</a></p>
        </>
      ) : null}
    </section>
  );
}
