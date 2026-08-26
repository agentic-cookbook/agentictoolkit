'use client'

"use client";

// src/auth/wired-provider.tsx
import { useState } from "react";
import { captureException as captureException2 } from "@agentic-toolkit/adh/telemetry/report-error";
import { markRetriedRequest } from "@agentic-toolkit/adh/telemetry/retry";
import {
  AuthProvider as ToolkitAuthProvider,
  setAuthErrorReporter,
  setAuthRetryMarker
} from "@agentic-toolkit/auth";

// src/auth/AppearanceSync.tsx
import { useEffect, useRef } from "react";
import { useAuth } from "@agentic-toolkit/auth";
import { authedJson } from "@agentic-toolkit/auth/client";
import {
  adoptAppearance,
  normalizeAppearance,
  resetAppearance
} from "@agenticdevelopertoolkit/themes";
import { captureException } from "@agentic-toolkit/adh/telemetry/report-error";
function AppearanceSync() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const themedFor = useRef(void 0);
  useEffect(() => {
    if (isLoading) return;
    const identity = isAuthenticated ? user?.id ?? null : null;
    if (themedFor.current === identity) return;
    themedFor.current = identity;
    if (!identity) {
      resetAppearance();
      return;
    }
    let live = true;
    authedJson("/api/me/appearance").then(({ prefs }) => {
      if (live) adoptAppearance(normalizeAppearance(prefs));
    }).catch((err) => {
      if (!live) return;
      themedFor.current = void 0;
      captureException(err);
    });
    return () => {
      live = false;
    };
  }, [isAuthenticated, isLoading, user?.id]);
  return null;
}

// src/auth/wired-provider.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var wired = false;
function wireAdhTelemetry() {
  if (!wired) {
    wired = true;
    setAuthErrorReporter(captureException2);
    setAuthRetryMarker(markRetriedRequest);
  }
  return null;
}
function AuthProvider(props) {
  useState(wireAdhTelemetry);
  return /* @__PURE__ */ jsxs(ToolkitAuthProvider, { ...props, children: [
    /* @__PURE__ */ jsx(AppearanceSync, {}),
    props.children
  ] });
}

// src/auth/useAppearanceSettings.ts
import { useCallback } from "react";
import { useAuth as useAuth2 } from "@agentic-toolkit/auth";
import { authedRequest } from "@agentic-toolkit/auth/client";
import { useAppearancePreferences } from "@agenticdevelopertoolkit/themes";
import { captureException as captureException3 } from "@agentic-toolkit/adh/telemetry/report-error";
function useAppearanceSettings() {
  const { prefs, set: setLocal } = useAppearancePreferences();
  const { isAuthenticated } = useAuth2();
  const set = useCallback(
    (patch) => {
      const next = { ...prefs, ...patch };
      setLocal(patch);
      if (!isAuthenticated) return;
      authedRequest("/api/me/appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      }).catch(captureException3);
    },
    [prefs, setLocal, isAuthenticated]
  );
  return { prefs, set };
}
export {
  AppearanceSync,
  AuthProvider,
  useAppearanceSettings
};
//# sourceMappingURL=index.js.map