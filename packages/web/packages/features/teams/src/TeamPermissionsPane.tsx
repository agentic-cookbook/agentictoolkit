"use client";

import type { ReactNode } from "react";
import { FeatureTitle } from "@agentic-toolkit/resource";

/** Permissions feature for the ACTIVE team. Placeholder — coming soon. */
export function TeamPermissionsPane({ title }: { title?: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {title && <FeatureTitle title={title} />}
      <section className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        <div className="flex min-h-[200px] flex-1 items-center justify-center rounded-lg border border-dashed border-apt-border p-8 text-center text-sm text-apt-text-muted">
          Permissions are coming soon.
        </div>
      </section>
    </div>
  );
}
