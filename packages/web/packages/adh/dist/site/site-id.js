'use client'

"use client";

// src/site/site-id.tsx
import { createContext, useContext } from "react";
import { jsx } from "react/jsx-runtime";
var SiteIdContext = createContext(null);
function SiteIdProvider({ siteId, children }) {
  return /* @__PURE__ */ jsx(SiteIdContext.Provider, { value: siteId, children });
}
function useSiteId() {
  const id = useContext(SiteIdContext);
  if (id === null) {
    throw new Error("useSiteId must be used within <SiteIdProvider> (mounted by the workspace layout)");
  }
  return id;
}
function useSiteIdOrNull() {
  return useContext(SiteIdContext);
}
export {
  SiteIdProvider,
  useSiteId,
  useSiteIdOrNull
};
//# sourceMappingURL=site-id.js.map