import { type ReactNode } from "react";

/**
 * The label/description column every setting row shares, with its control alongside.
 *
 * Its own module because the Appearance panel and the dev-only ThemePickerRow both render
 * it, and the picker is loaded through a `next/dynamic` FROM the panel — importing it back
 * out of AppearancePanel would close a cycle across that chunk boundary.
 */
export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm font-medium text-apt-text">{label}</div>
        {description && (
          <p className="mt-0.5 text-xs text-apt-text-muted">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
