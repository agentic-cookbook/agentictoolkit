import type { ReactNode } from "react";

import { cn } from "../lib/utils";

/**
 * The platform's standard "nothing here yet" placeholder — a dashed-border panel
 * with a centered title, optional description and action. Replaces the ad-hoc
 * `border-dashed` boxes that were copy-pasted across panes so every empty state
 * reads the same. This is the one blessed home for the dashed-border treatment.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-apt-border p-6 text-center",
        className,
      )}
    >
      {icon && <div className="text-apt-text-dim [&_svg]:size-6">{icon}</div>}
      <p className="text-sm text-apt-text-muted">{title}</p>
      {description && <p className="max-w-prose text-xs text-apt-text-dim">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
