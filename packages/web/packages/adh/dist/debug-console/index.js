'use client'

"use client";

// src/debug-console/index.tsx
import {
  DebugConsoleWindow as ToolkitDebugConsoleWindow
} from "@agentic-toolkit/adh/debug-env";
import {
  useEnvOverride,
  setEnvOverride,
  parseEnvOverride
} from "@agentic-toolkit/adh/header";
import { jsx } from "react/jsx-runtime";
var themeAreas = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "local" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "testing" || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "staging" ? () => import("@agentic-toolkit/adh/theme-editor").then((m) => m.themeAreasSurface) : () => Promise.reject(new Error("The site-theme editor is not built into production bundles."));
function DebugConsoleWindow({ open, onClose }) {
  return /* @__PURE__ */ jsx(
    ToolkitDebugConsoleWindow,
    {
      open,
      onClose,
      envOverride: ENV_OVERRIDE,
      themeAreas
    }
  );
}
var ENV_OVERRIDE = {
  useEnvOverride,
  setEnvOverride: (env) => setEnvOverride(parseEnvOverride(env))
};
export {
  DebugConsoleWindow
};
//# sourceMappingURL=index.js.map