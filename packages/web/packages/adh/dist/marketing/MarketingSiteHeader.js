'use client'

"use client";

// src/marketing/MarketingSiteHeader.tsx
import { makeSmartHeaderAuth } from "@agentic-toolkit/adh/header-auth";
import { SiteHeader } from "@agentic-toolkit/adh/header";
import { jsx } from "react/jsx-runtime";
var useMarketingHeaderAuth = makeSmartHeaderAuth({ clientId: "adh" });
function MarketingSiteHeader({ siteId, navLinks }) {
  return /* @__PURE__ */ jsx(SiteHeader, { siteId, useAuthSource: useMarketingHeaderAuth, navLinks });
}
export {
  MarketingSiteHeader
};
//# sourceMappingURL=MarketingSiteHeader.js.map