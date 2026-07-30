'use client'

"use client";

// src/telemetry/analytics.ts
import posthog from "posthog-js";
import { markRetriedRequest, consumeRetriedFlag } from "@agentic-toolkit/adh/telemetry/retry";
var EVENT_HTTP_REQUEST = "http_request";
var posthogReady = false;
function setPosthogReady(ready) {
  posthogReady = ready;
}
var debugEnabled = true;
function captureEvent(name, props) {
  try {
    if (posthogReady) posthog.capture(name, props);
    if (debugEnabled) console.debug("[perf]", name, props);
  } catch {
  }
}
var UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
var DIGIT_RUN = /\d{4,}/g;
function scrubPath(url) {
  let pathname;
  try {
    const u = new URL(url, "http://_");
    if (u.protocol !== "http:" && u.protocol !== "https:") return ":non-http";
    pathname = u.pathname;
  } catch {
    const cuts = [url.indexOf("?"), url.indexOf("#")].filter((i) => i >= 0);
    pathname = cuts.length ? url.slice(0, Math.min(...cuts)) : url;
  }
  return pathname.replace(UUID_ANYWHERE, ":id").replace(DIGIT_RUN, ":id");
}

// src/telemetry/fetch-instrumentation.ts
var installed = false;
var coldUsed = false;
function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
function round1(n) {
  return Math.round(n * 10) / 10;
}
function buildTelemetrySkip() {
  const hosts = /* @__PURE__ */ new Set();
  let posthogPathPrefix = null;
  const phRaw = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  try {
    const ph = new URL(phRaw, window.location.href);
    if (/^https?:\/\//i.test(phRaw)) {
      hosts.add(ph.host);
    } else if (ph.pathname.length > 1) {
      posthogPathPrefix = ph.pathname.replace(/\/$/, "");
    }
  } catch {
  }
  const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN;
  if (dsn) {
    try {
      hosts.add(new URL(dsn).host);
    } catch {
    }
  }
  return (url) => {
    try {
      const u = new URL(url, window.location.href);
      if (hosts.has(u.host)) return true;
      if (posthogPathPrefix && u.host === window.location.host && (u.pathname === posthogPathPrefix || u.pathname.startsWith(`${posthogPathPrefix}/`))) {
        return true;
      }
    } catch {
    }
    return false;
  };
}
function parseServerTiming(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(",")) {
    const seg = part.trim();
    const name = seg.split(";")[0]?.trim();
    if (!name) continue;
    const metric = out[name] ?? (out[name] = {});
    const dur = seg.match(/dur=([^;,]+)/);
    if (dur) {
      const v = Number(dur[1]?.trim());
      if (Number.isFinite(v)) metric.dur = v;
    }
    const desc = seg.match(/desc="([^"]*)"/);
    if (desc) metric.desc = desc[1];
  }
  return out;
}
function hasAuthHeader(input, init2) {
  if (typeof Request !== "undefined" && input instanceof Request && input.headers.has("authorization")) {
    return true;
  }
  const h = init2?.headers;
  if (!h) return false;
  if (typeof Headers !== "undefined" && h instanceof Headers) return h.has("authorization");
  if (Array.isArray(h)) return h.some(([k]) => String(k).toLowerCase() === "authorization");
  return Object.keys(h).some((k) => k.toLowerCase() === "authorization");
}
function record(o) {
  try {
    const props = {
      path: scrubPath(o.url),
      method: o.method,
      status: o.status,
      ok: o.ok,
      duration_ms: Math.round(performance.now() - o.start),
      cold: o.cold,
      authenticated: o.authenticated,
      retried: o.retried
    };
    if (o.res) {
      const st = parseServerTiming(o.res.headers.get("Server-Timing"));
      if (st.app?.dur != null) props.server_ms = round1(st.app.dur);
      if (st.db?.dur != null) props.db_ms = round1(st.db.dur);
      const count = st.db?.desc != null ? Number(st.db.desc) : NaN;
      if (Number.isFinite(count)) props.db_count = count;
    }
    captureEvent(EVENT_HTTP_REQUEST, props);
  } catch {
  }
}
function instrumentFetch() {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const original = window.fetch.bind(window);
  const skip = buildTelemetrySkip();
  window.fetch = async (input, init2) => {
    let url;
    let method;
    try {
      if (typeof Request !== "undefined" && input instanceof Request) {
        url = input.url;
        method = (init2?.method ?? input.method ?? "GET").toUpperCase();
      } else {
        url = typeof input === "string" ? input : String(input);
        method = (init2?.method ?? "GET").toUpperCase();
      }
    } catch {
      return original(input, init2);
    }
    if (skip(url)) return original(input, init2);
    const authenticated = safe(() => hasAuthHeader(input, init2), false);
    const retried = consumeRetriedFlag(init2) || (typeof Request !== "undefined" && input instanceof Request ? consumeRetriedFlag(input) : false);
    const cold = !coldUsed;
    coldUsed = true;
    const start = performance.now();
    try {
      const res = await original(input, init2);
      record({ url, method, status: res.status, ok: res.ok, start, authenticated, retried, cold, res });
      return res;
    } catch (err) {
      record({ url, method, status: 0, ok: false, start, authenticated, retried, cold });
      throw err;
    }
  };
}

// src/telemetry/TelemetryProvider.tsx
import { useEffect } from "react";
import * as Sentry from "@sentry/react";
import posthog2 from "posthog-js";
import { setErrorReporter } from "@agentic-toolkit/adh/telemetry/report-error";
var started = false;
function scrubUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    return u.origin + scrubPath(u.pathname);
  } catch {
    return scrubPath(url);
  }
}
function startTelemetry(resolveEnvironment) {
  if (started || typeof window === "undefined") return;
  started = true;
  const environment = resolveEnvironment(window.location.hostname);
  const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      // Tag every event with the env the HOST resolved above from the hostname
      // (testing./staging./else prod; *.local → local, or whatever scheme the host uses) —
      // the toolkit has no site registry of its own, so this is injected. Without it Sentry
      // defaults `environment` to "production", so a testing/staging error was mislabeled
      // production and impossible to triage by env. Set once at init — the real host is
      // authoritative (the dev env override is a display-only concern).
      environment,
      // The deploy's commit SHA (next-config-base inlines VERCEL_GIT_COMMIT_SHA as
      // NEXT_PUBLIC_ADH_RELEASE), so every error is attributable to a deploy — as the backend
      // already tags its own. Omitted when blank (local dev / no Vercel SHA). This is also the
      // key future source-map artifacts upload against.
      ...process.env.NEXT_PUBLIC_ADH_RELEASE ? { release: process.env.NEXT_PUBLIC_ADH_RELEASE } : {},
      tracesSampleRate: 0,
      // errors only — no performance tracing (GlitchTip is errors-only)
      sendDefaultPii: false,
      // never infer the user's IP or attach PII
      beforeSend(event) {
        delete event.user;
        if (event.request) {
          delete event.request.cookies;
          event.request.url = scrubUrl(event.request.url);
        }
        return event;
      }
    });
  }
  const phKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (phKey) {
    posthog2.init(phKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      autocapture: false,
      // the heart of "default to less": no automatic click/input capture
      disable_session_recording: true,
      // no screen replay, ever
      capture_pageview: "history_change",
      // traffic only — pageviews on SPA route change
      // Real-user Core Web Vitals (LCP/INP/CLS/FCP) as `$web_vitals` events. Distinct
      // from autocapture (which stays off) and numeric-only, so it carries no PII.
      capture_performance: { web_vitals: true },
      persistence: "memory",
      // cookieless: no cross-session id ⇒ no consent banner
      person_profiles: "identified_only",
      // never create a profile for an anonymous visitor
      mask_all_text: true,
      // belt-and-suspenders if any capture path ever runs
      mask_all_element_attributes: true,
      disable_surveys: true,
      before_send: (event) => {
        if (event?.properties) {
          event.properties.$current_url = scrubUrl(event.properties.$current_url);
          event.properties.$referrer = scrubUrl(event.properties.$referrer);
          if (typeof event.properties.$pathname === "string") {
            event.properties.$pathname = scrubPath(event.properties.$pathname);
          }
        }
        return event;
      }
    });
    setPosthogReady(true);
  }
  setErrorReporter((error, context) => {
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(context);
      Sentry.captureException(error);
    });
    captureEvent("error_reported", {
      // `error_name` (not `name`) so a caller-supplied `name` in context can't be
      // silently clobbered by the spread.
      error_name: error instanceof Error ? error.name : typeof error,
      ...context
    });
  });
  instrumentFetch();
}
function TelemetryProvider({ children, resolveEnvironment }) {
  useEffect(() => {
    startTelemetry(resolveEnvironment);
  }, [resolveEnvironment]);
  return children;
}

// src/telemetry/index.ts
import {
  setErrorReporter as setErrorReporter2,
  captureException as captureException2,
  reportUnexpectedError
} from "@agentic-toolkit/adh/telemetry/report-error";

// src/telemetry/SiteTelemetryProvider.tsx
import { detectEnv } from "@agentic-toolkit/adh-registry";
import { jsx } from "react/jsx-runtime";
function SiteTelemetryProvider({ children }) {
  return /* @__PURE__ */ jsx(TelemetryProvider, { resolveEnvironment: detectEnv, children });
}
export {
  EVENT_HTTP_REQUEST,
  SiteTelemetryProvider,
  TelemetryProvider,
  captureEvent,
  captureException2 as captureException,
  consumeRetriedFlag,
  instrumentFetch,
  markRetriedRequest,
  reportUnexpectedError,
  scrubPath,
  setErrorReporter2 as setErrorReporter,
  setPosthogReady
};
//# sourceMappingURL=index.js.map