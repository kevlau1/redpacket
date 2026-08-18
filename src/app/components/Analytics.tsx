"use client";

import { Analytics as VercelAnalytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * A claim link carries the password in the fragment and the packet id in the path.
 * Report the route shape only, and drop the event outright if the URL cannot be
 * parsed — a beacon is never worth leaking a password over.
 */
function redact(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/^\/claim\/[^/]+/, "/claim/[dropId]");
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export default function Analytics() {
  return <VercelAnalytics beforeSend={redact} />;
}
