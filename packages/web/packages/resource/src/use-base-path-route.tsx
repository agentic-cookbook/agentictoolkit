"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * URL push helpers for a deep-linked feature mounted at an explicit `basePath`
 * (the host route supplies it — `/<slug>/<feature>` on the hub, `/home` on a
 * feature site; never derived from useParams inside the package). The port of
 * the hub's `useFeatureRoute` with the base made a parameter:
 *   - `pushSegment(id)`  → `<basePath>/<id>`, or the base when id is null.
 *   - `pushNested(parent, child)` → `<basePath>/<parent>/<child>`, `.../<parent>`
 *     when the child is null, or the base when there's no parent — for two-level
 *     selections (persona ▸ sub-tab, dashboards section ▸ row).
 *   - `pushDeep(...segs)` → `<basePath>/<seg>/<seg>/…` for three-plus-level
 *     selections; falsy segments are dropped, so a null tail clears that level.
 * Scroll is preserved on every push so drilling in doesn't jump the page.
 */
export function useBasePathRoute(basePath: string): {
  pushSegment: (id: string | null) => void;
  pushNested: (parent: string | undefined, child: string | null) => void;
  pushDeep: (...segs: (string | null | undefined)[]) => void;
} {
  const router = useRouter();
  const pushSegment = useCallback(
    (id: string | null) => router.push(id ? `${basePath}/${id}` : basePath, { scroll: false }),
    [router, basePath],
  );
  const pushNested = useCallback(
    (parent: string | undefined, child: string | null) =>
      router.push(
        parent ? (child ? `${basePath}/${parent}/${child}` : `${basePath}/${parent}`) : basePath,
        { scroll: false },
      ),
    [router, basePath],
  );
  const pushDeep = useCallback(
    (...segs: (string | null | undefined)[]) => {
      // Drop falsy (null/undefined/empty) segments from the tail so clearing a deeper level routes
      // to the shorter URL (`.../member/persona/subtab` → `.../member/persona` when subtab is null).
      const tail = segs.filter((s): s is string => Boolean(s)).join("/");
      router.push(tail ? `${basePath}/${tail}` : basePath, { scroll: false });
    },
    [router, basePath],
  );
  return { pushSegment, pushNested, pushDeep };
}
