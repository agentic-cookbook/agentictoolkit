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
import { themeAreasSurface } from "@agentic-toolkit/adh/theme-editor";
import { jsx } from "react/jsx-runtime";
function DebugConsoleWindow({ open, onClose }) {
  return /* @__PURE__ */ jsx(
    ToolkitDebugConsoleWindow,
    {
      open,
      onClose,
      envOverride: ENV_OVERRIDE,
      themeAreas: themeAreasSurface
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