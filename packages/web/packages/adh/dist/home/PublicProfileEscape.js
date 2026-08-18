'use client'

"use client";

// src/home/PublicProfileEscape.tsx
import { usePathname } from "next/navigation";
import { Fragment, jsx } from "react/jsx-runtime";
function PublicProfileEscape({ ungated, children }) {
  const pathname = usePathname();
  return /* @__PURE__ */ jsx(Fragment, { children: isPrincipalProfilePath(pathname) ? ungated : children });
}
function isPrincipalProfilePath(pathname) {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[1] === "profile";
}
export {
  PublicProfileEscape
};
//# sourceMappingURL=PublicProfileEscape.js.map