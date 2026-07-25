// .../features/personas/src/DemoFacet.tsx
"use client";

import type { CannedChatConfig } from "@agentic-toolkit/data/personas";
import { RowsField } from "./RowsField";

/** Mirrors the backend's CANNED_DEFAULT_PACING. */
export const DEMO_DEFAULT_CONFIG: CannedChatConfig = {
  enabled: false,
  pacing: { thinkMinMs: 2000, thinkJitterMs: 3000, tokenMinMs: 45, tokenJitterMs: 55, reveal: "word" },
  script: { intro: [], seeded: [], fallbacks: [], onExhausted: "reshuffle" },
};

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        className="rounded border px-2 py-1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

/**
 * Demo mode authoring. The script never reaches a visitor's browser — it is stored on the
 * persona and consumed server-side — so everything here is owner-only.
 */
export function DemoFacet({
  value,
  onChange,
}: {
  value: CannedChatConfig | null;
  onChange: (next: CannedChatConfig | null) => void;
}) {
  const cfg = value ?? DEMO_DEFAULT_CONFIG;
  const patch = (p: Partial<CannedChatConfig>) => onChange({ ...cfg, ...p });
  const patchScript = (p: Partial<CannedChatConfig["script"]>) => patch({ script: { ...cfg.script, ...p } });
  const patchPacing = (p: Partial<CannedChatConfig["pacing"]>) => patch({ pacing: { ...cfg.pacing, ...p } });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
        <span>Enable demo chat</span>
      </label>
      <p className="text-xs opacity-70">
        A scripted conversation anyone can hold with this persona — including signed-out visitors,
        and even with no LLM service configured. Demo conversations never count toward this
        persona&apos;s stats, XP, or badges.
      </p>

      <fieldset className="flex flex-wrap gap-3">
        <legend className="text-sm font-medium">Pacing</legend>
        <NumberField label="Think delay (ms)" value={cfg.pacing.thinkMinMs} onChange={(n) => patchPacing({ thinkMinMs: n })} />
        <NumberField label="Think jitter (ms)" value={cfg.pacing.thinkJitterMs} onChange={(n) => patchPacing({ thinkJitterMs: n })} />
        <NumberField label="Token delay (ms)" value={cfg.pacing.tokenMinMs} onChange={(n) => patchPacing({ tokenMinMs: n })} />
        <NumberField label="Token jitter (ms)" value={cfg.pacing.tokenJitterMs} onChange={(n) => patchPacing({ tokenJitterMs: n })} />
      </fieldset>

      <RowsField
        label="Opening lines"
        hint="Played in order for the first replies, whatever the visitor says."
        value={cfg.script.intro}
        onChange={(intro) => patchScript({ intro })}
        blankRow={() => ""}
        addLabel="Add opening line"
        renderRow={(row, set) => (
          <input aria-label="Opening line" className="w-full rounded border px-2 py-1" value={row} onChange={(e) => set(e.target.value)} />
        )}
      />

      <RowsField
        label="Keyword replies"
        hint="Comma-separated words or phrases — matched literally, not as regular expressions. The first row with a match wins."
        value={cfg.script.seeded}
        onChange={(seeded) => patchScript({ seeded })}
        blankRow={() => ({ match: [], reply: "" })}
        addLabel="Add keyword reply"
        renderRow={(row, set) => (
          <div className="flex min-w-0 flex-col gap-1">
            <input
              aria-label="Keywords"
              className="w-full rounded border px-2 py-1"
              placeholder="matrix, rain"
              value={row.match.join(", ")}
              onChange={(e) => set({ ...row, match: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
            <input
              aria-label="Reply"
              className="w-full rounded border px-2 py-1"
              value={row.reply}
              onChange={(e) => set({ ...row, reply: e.target.value })}
            />
          </div>
        )}
      />

      <RowsField
        label="Fallback replies"
        hint="Used when nothing else matches. Each is used once before any repeats."
        value={cfg.script.fallbacks}
        onChange={(fallbacks) => patchScript({ fallbacks })}
        blankRow={() => ""}
        addLabel="Add fallback"
        renderRow={(row, set) => (
          <input aria-label="Fallback" className="w-full rounded border px-2 py-1" value={row} onChange={(e) => set(e.target.value)} />
        )}
      />

      <label className="flex flex-col gap-1 text-sm">
        <span>When every fallback has been used</span>
        <select
          className="rounded border px-2 py-1"
          value={cfg.script.onExhausted}
          onChange={(e) => patchScript({ onExhausted: e.target.value as "reshuffle" | "hold-last" })}
        >
          <option value="reshuffle">Start over</option>
          <option value="hold-last">Repeat the last reply</option>
        </select>
      </label>
    </div>
  );
}
