"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

const PRIVATE_QUERY_PARAMS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "code",
  "email",
  "session",
  "session_id",
  "auth",
  "password",
  "state",
]);

/**
 * Count public site traffic, not admin sessions or personal information.
 * The analytics provider uses aggregate, cookie-free visitor statistics.
 */
export default function VisitorAnalytics() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => {
        try {
          const url = new URL(event.url);
          if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
            return null;
          }

          for (const key of Array.from(url.searchParams.keys())) {
            if (PRIVATE_QUERY_PARAMS.has(key.toLowerCase())) {
              url.searchParams.delete(key);
            }
          }
          url.hash = "";
          return { ...event, url: url.toString() };
        } catch {
          return null;
        }
      }}
    />
  );
}
