import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERCEL_PROJECT_ID = "prj_1Ni5S4z7UFqrpQvKV9gWgc4ZhImq";
const VERCEL_TEAM_ID = "team_AH72aX1BaaPucIOvrSgvpEhw";
const SUPABASE_URL = "https://yufptpfiwdbzzrvhkvux.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JpayDIqb8Gy-hnGSL99fdg_jmKQQNJh";
const ALLOWED_ADMINS = new Set(["schofieldtierra@gmail.com", "zanibethel@gmail.com"]);

type Metrics = { pageviews: number; visitors: number };
type VercelCount = { data?: { pageviews?: number; visitors?: number } };
type VercelAggregate = { data?: Record<string, unknown>[] };

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function metric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function label(value: unknown, max = 120) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function dayOffset(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function toMetrics(value: VercelCount): Metrics {
  return { pageviews: metric(value.data?.pageviews), visitors: metric(value.data?.visitors) };
}

async function queryAnalytics(
  token: string,
  endpoint: "count" | "aggregate",
  since: string,
  until: string,
  by?: "day" | "requestPath" | "referrerHostname",
): Promise<VercelCount & VercelAggregate> {
  const url = new URL(`https://api.vercel.com/v1/query/web-analytics/visits/${endpoint}`);
  url.searchParams.set("projectId", VERCEL_PROJECT_ID);
  url.searchParams.set("teamId", VERCEL_TEAM_ID);
  url.searchParams.set("since", since);
  url.searchParams.set("until", until);
  if (by) {
    url.searchParams.set("by", by);
    url.searchParams.set("limit", by === "day" ? "31" : "10");
  }
  const result = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) throw new Error("vercel_auth");
    if (result.status === 404) throw new Error("vercel_not_found");
    if (result.status === 429) throw new Error("vercel_rate_limit");
    throw new Error("vercel_unavailable");
  }
  const json: unknown = await result.json();
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("vercel_unexpected_response");
  }
  return json as VercelCount & VercelAggregate;
}

export async function GET(request: NextRequest) {
  // Never accept a Vercel token from the browser. Verify Supabase identity on
  // the server before using the secret to read visitor statistics.
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ") || header.length > 4096) {
    return response({ error: "Sign in to the Camp Rise Again admin page to see analytics." }, 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await supabase.auth.getUser(header.slice(7));
    if (error || !user || !ALLOWED_ADMINS.has(user.email?.toLowerCase() || "")) {
      return response({ error: "Your account is not authorized to view analytics." }, 403);
    }
  } catch {
    return response({ error: "Could not verify your admin session." }, 503);
  }

  const secret = process.env.VERCEL_ANALYTICS_READ_TOKEN;
  if (!secret) {
    return response({
      code: "needs_setup",
      error: "The dashboard is installed, but its private Vercel Analytics access token hasn't been configured yet.",
    }, 503);
  }

  const days = new URL(request.url).searchParams.get("days") === "30" ? 30 : 7;
  const since = dayOffset(days - 1);
  const until = dayOffset(0);

  try {
    const [totals, daysResponse, pagesResponse, sourcesResponse] = await Promise.all([
      queryAnalytics(secret, "count", since, until),
      queryAnalytics(secret, "aggregate", since, until, "day"),
      queryAnalytics(secret, "aggregate", since, until, "requestPath"),
      queryAnalytics(secret, "aggregate", since, until, "referrerHostname"),
    ]);

    const rows = (result: VercelAggregate): Record<string, unknown>[] =>
      Array.isArray(result.data) ? result.data : [];

    const daily = rows(daysResponse)
      .map((r) => ({
        date: label(r.timestamp).slice(0, 10),
        visitors: metric(r.visitors),
        pageviews: metric(r.pageviews),
      }))
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    const pages = rows(pagesResponse)
      .map((r) => ({
        path: label(r.requestPath || r.route || "Unknown"),
        visitors: metric(r.visitors),
        pageviews: metric(r.pageviews),
      }))
      .filter((r) => r.path && !r.path.startsWith("/admin"))
      .sort((a, b) => b.visitors - a.visitors);

    const referrers = rows(sourcesResponse)
      .map((r) => ({
        source: label(r.referrerHostname || "Direct / unknown"),
        visitors: metric(r.visitors),
        pageviews: metric(r.pageviews),
      }))
      .sort((a, b) => b.visitors - a.visitors);

    return response({
      source: "Vercel Web Analytics",
      periodDays: days,
      since,
      until,
      updatedAt: new Date().toISOString(),
      totals: toMetrics(totals),
      daily,
      pages,
      referrers,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "";
    const auth = reason === "vercel_auth";
    const missing = reason === "vercel_not_found";
    const limited = reason === "vercel_rate_limit";
    return response({
      code: auth ? "vercel_auth" : missing ? "vercel_not_found" : limited ? "vercel_rate_limit" : "vercel_unavailable",
      error: auth
        ? "Vercel denied analytics access. Check the server access token and its project permissions."
        : missing
          ? "Vercel's Web Analytics API has not made this project's data available yet."
          : limited
            ? "Vercel is temporarily limiting analytics requests. Please try again shortly."
            : "Visitor statistics are temporarily unavailable. The public website is not affected.",
    }, 502);
  }
}
