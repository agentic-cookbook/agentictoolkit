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
import { useState } from "react";
import { CommaListInput } from "./CommaListInput";
import { InkScriptEditor } from "./InkScriptEditor";
import { RowsField } from "./RowsField";

/** Mirrors the backend's CANNED_DEFAULT_PACING. */
export const DEMO_DEFAULT_CONFIG: CannedChatConfig = {
  enabled: false,
  pacing: { thinkMinMs: 2000, thinkJitterMs: 3000, tokenMinMs: 45, tokenJitterMs: 55, reveal: "word" },
  script: { intro: [], seeded: [], fallbacks: [], onExhausted: "reshuffle" },
};

/** A pacing number, edited through a local draft string so that the states you pass THROUGH
 *  while typing survive the keystroke that produced them.
 *
 *  A directly-controlled `value={number}` cannot: `Number("")` is 0, so clearing the box to
 *  retype it wrote 0 into the config and re-rendered "0" under the caret, and clamping on every
 *  keystroke meant typing "5000" toward "50000" snapped back to the ceiling mid-word. Both make
 *  the field feel like it is fighting the author.
 *
 *  So: the draft is what the author sees while the box is focused, and it propagates upward only
 *  when it parses — empty or half-typed input ("1e" is NaN) leaves the last good value in place
 *  rather than writing NaN or 0 into the server's pacing math. Clamping to `max` waits for blur,
 *  which is what the server would do to it anyway (see DEMO_MAX_* — the pacing bounds exist
 *  because the turn's DB transaction stays open for the whole stream); doing it here too means
 *  the author sees the value that will actually be used instead of one silently overridden on
 *  save. Blur precedes the click that saves, so the clamp always runs first. */
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
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={label} className="min-w-[9rem] flex-1">
      <Input
        type="number"
        min={0}
        max={max}
        value={draft ?? String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const n = Number(raw);
          if (raw.trim() !== "" && Number.isFinite(n) && n >= 0) onChange(n);
        }}
        onBlur={() => {
          // Clamps what was TYPED, not the incoming `value`: this component is controlled, so
          // reading the prop here would clamp only after the parent had already accepted the
          // over-max number, and never at all if it hadn't.
          const n = Number(draft);
          setDraft(null);
          if (draft !== null && draft.trim() !== "" && Number.isFinite(n) && n > max) onChange(max);
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
  // The server's own rule, not a preference: a non-blank source means the ink engine takes the turn.
  const inkRuns = (cfg.ink?.source ?? "").trim() !== "";

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

      {/* Two engines, one flag. The server picks ink whenever the config carries a non-blank
          source (`llm/facets/cannedChat.ts`), so that is the rule stated here rather than a
          switch the author sets: a switch would be a second place the choice is recorded, and
          the two could disagree. Both sets of fields stay editable either way — the unused
          half is a draft being kept, not dead config. */}
      <FieldGroup
        title="Conversation"
        trailing={
          <span className="text-xs text-apt-text-muted">{inkRuns ? "Ink" : "Keywords"}</span>
        }
      >
        <p className="text-xs text-apt-text-muted">
          {inkRuns
            ? "This persona demos on its ink script. The keyword fields below are kept but not used — clear the script to go back to them."
            : "This persona demos on the keyword fields below. Write an ink script to run that instead."}
        </p>
        <InkScriptEditor value={cfg.ink ?? null} onChange={(ink) => patch({ ink })} />
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
            <CommaListInput label="Keywords" placeholder="matrix, rain" value={row.match} onChange={(match) => set({ ...row, match })} />
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
        hint="Used when nothing else matches. Each is used once before any repeats. With none, the persona replays your opening and keyword lines instead — so a keyword reply can be given to a message that matches none of its keywords."
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
