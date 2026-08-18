"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * A claim link carries the password in the fragment and the packet id in the path,
 * and both beacons build their own `url` from the live location. Report the route
 * shape only, and drop the event outright if the URL cannot be parsed — telemetry
 * is never worth leaking a password over.
 */
function redact<T extends { url: string }>(event: T): T | null {
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

export default function VercelTelemetry() {
  return (
    <>
      <Analytics beforeSend={redact} />
      <SpeedInsights beforeSend={redact} />
    </>
  );
}
