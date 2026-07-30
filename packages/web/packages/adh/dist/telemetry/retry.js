'use client'

"use client";

// src/telemetry/retry.ts
var retriedInits = /* @__PURE__ */ new WeakSet();
function markRetriedRequest(init) {
  retriedInits.add(init);
}
function consumeRetriedFlag(init) {
  if (!init || typeof init !== "object") return false;
  if (retriedInits.has(init)) {
    retriedInits.delete(init);
    return true;
  }
  return false;
}
export {
  consumeRetriedFlag,
  markRetriedRequest
};
//# sourceMappingURL=retry.js.map