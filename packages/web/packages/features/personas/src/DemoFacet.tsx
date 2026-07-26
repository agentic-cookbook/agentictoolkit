// .../features/personas/src/DemoFacet.tsx
"use client";

import {
  canDemoChat,
  DEMO_MAX_THINK_MS,
  DEMO_MAX_TOKEN_MS,
  type CannedChatConfig,
} from "@agentic-toolkit/data/personas";
import { Field, FieldGroup } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Checkbox } from "@agentic-toolkit/ui/components/checkbox";
import { RowsField } from "./RowsField";

/** Mirrors the backend's CANNED_DEFAULT_PACING. */
export const DEMO_DEFAULT_CONFIG: CannedChatConfig = {
  enabled: false,
  pacing: { thinkMinMs: 2000, thinkJitterMs: 3000, tokenMinMs: 45, tokenJitterMs: 55, reveal: "word" },
  script: { intro: [], seeded: [], fallbacks: [], onExhausted: "reshuffle" },
};

/** A pacing number. Empty or non-numeric input clamps to 0 rather than writing NaN into
 *  the config — `Number("")` is 0 but `Number("1e")` is NaN, and a NaN here survives all
 *  the way to the server's pacing math. Over-`max` input clamps down to the ceiling, which
 *  is what the server would do to it anyway (see DEMO_MAX_* — the pacing bounds exist because
 *  the turn's DB transaction stays open for the whole stream); clamping here means the author
 *  sees the value that will actually be used instead of one silently overridden on save. */
function NumberField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label} className="min-w-[9rem] flex-1">
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0);
        }}
      />
    </Field>
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
      {/* Checkbox carries its own accessible name via aria-label and the visible copy is a
          demoted sibling OUTSIDE it — the same shape AbilitiesPanel's grant rows use. */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={cfg.enabled}
          onCheckedChange={(checked) => patch({ enabled: checked === true })}
          aria-label="Enable demo chat"
        />
        <span>Enable demo chat</span>
      </div>
      <p className="text-xs text-apt-text-muted">
        A scripted conversation anyone can hold with this persona — including signed-out visitors,
        and even with no LLM service configured. Demo conversations never count toward this
        persona&apos;s stats, XP, or badges.
      </p>

      {/* Enabled but unanswerable: the server asks the SAME question (canDemoChat) before it
          claims a turn, so this script demos nothing — the persona falls through to its LLM
          service, or tells the visitor it has none. Said here, where it can be fixed, rather
          than left for the author to discover from the visitor's side. */}
      {cfg.enabled && !canDemoChat(cfg) ? (
        <p role="status" className="text-xs text-apt-gold">
          Demo chat is on, but this script has no line the persona can say — add an opening line,
          a keyword reply, or a fallback. Until then visitors get the persona&apos;s normal
          replies, not the demo.
        </p>
      ) : null}

      <FieldGroup title="Pacing" className="flex-row flex-wrap gap-3">
        <NumberField label="Think delay (ms)" value={cfg.pacing.thinkMinMs} max={DEMO_MAX_THINK_MS} onChange={(n) => patchPacing({ thinkMinMs: n })} />
        <NumberField label="Think jitter (ms)" value={cfg.pacing.thinkJitterMs} max={DEMO_MAX_THINK_MS} onChange={(n) => patchPacing({ thinkJitterMs: n })} />
        <NumberField label="Token delay (ms)" value={cfg.pacing.tokenMinMs} max={DEMO_MAX_TOKEN_MS} onChange={(n) => patchPacing({ tokenMinMs: n })} />
        <NumberField label="Token jitter (ms)" value={cfg.pacing.tokenJitterMs} max={DEMO_MAX_TOKEN_MS} onChange={(n) => patchPacing({ tokenJitterMs: n })} />
      </FieldGroup>

      <RowsField
        label="Opening lines"
        hint="Played in order for the first replies, whatever the visitor says."
        value={cfg.script.intro}
        onChange={(intro) => patchScript({ intro })}
        blankRow={() => ""}
        addLabel="Add opening line"
        renderRow={(row, set) => (
          <Input aria-label="Opening line" value={row} onChange={(e) => set(e.target.value)} />
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
            <Input
              aria-label="Keywords"
              placeholder="matrix, rain"
              value={row.match.join(", ")}
              onChange={(e) => set({ ...row, match: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
            <Input
              aria-label="Reply"
              value={row.reply}
              onChange={(e) => set({ ...row, reply: e.target.value })}
            />
          </div>
        )}
      />

      <RowsField
        label="Fallback replies"
        hint="Used when nothing else matches. Each is used once before any repeats. With none, your opening and triggered lines carry the whole conversation."
        value={cfg.script.fallbacks}
        onChange={(fallbacks) => patchScript({ fallbacks })}
        blankRow={() => ""}
        addLabel="Add fallback"
        renderRow={(row, set) => (
          <Input aria-label="Fallback" value={row} onChange={(e) => set(e.target.value)} />
        )}
      />

      {/* Governs whichever pool runs the conversation: the fallbacks when there are any,
          otherwise the opening and triggered lines themselves. Naming only the fallbacks
          left authors with no fallbacks unable to tell that their opening lines replay. */}
      <Field label="When every reply has been used">
        <Select
          value={cfg.script.onExhausted}
          onChange={(e) => patchScript({ onExhausted: e.target.value as "reshuffle" | "hold-last" })}
        >
          <option value="reshuffle">Start over</option>
          <option value="hold-last">Repeat the last reply</option>
        </Select>
      </Field>
    </div>
  );
}
