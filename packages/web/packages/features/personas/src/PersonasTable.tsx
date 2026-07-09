"use client";

import type { Persona } from "@agentic-toolkit/data/personas";

import { fmtDate } from "./format";

/**
 * The "All personas" landing: a compact index table (Name / Slug / Service /
 * Model / Updated) with a Preview link to each persona's public registry page.
 * Clicking a row opens that persona in the editor.
 */
export function PersonasTable({
  personas,
  onSelect,
  profileUrlFor,
}: {
  personas: Persona[];
  onSelect: (id: string) => void;
  /** The persona's public profile URL for a given slug. Omit to hide the Preview column's link
   *  affordance (the column header still renders, its cell just has no link). */
  profileUrlFor?: (slug: string) => string;
}) {
  if (personas.length === 0) {
    return <p className="px-6 pb-4 text-sm text-apt-text-muted">No personas yet.</p>;
  }
  return (
    <div className="px-6 pt-2 pb-6">
      <div className="overflow-hidden rounded-xl border border-apt-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-apt-border bg-apt-surface-2/40 text-left font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Service</th>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium text-right">Preview</th>
            </tr>
          </thead>
          <tbody>
            {personas.map((p, i) => (
              <tr
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`cursor-pointer transition-colors hover:bg-apt-surface-2 ${
                  i > 0 ? "border-t border-apt-border" : ""
                }`}
              >
                <td className="px-3 py-2 text-apt-text">{p.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-apt-text-muted">{p.slug}</td>
                <td className="px-3 py-2 text-apt-text-muted">{p.serviceName ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-apt-text-muted">{p.model ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-apt-text-dim">{fmtDate(p.updatedAt)}</td>
                <td className="px-3 py-2 text-right">
                  {profileUrlFor && (
                    <a
                      href={profileUrlFor(p.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border border-apt-border px-2 py-1 font-mono text-xs text-apt-text-muted outline-none transition-colors hover:border-apt-gold/60 hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
                    >
                      Preview
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
