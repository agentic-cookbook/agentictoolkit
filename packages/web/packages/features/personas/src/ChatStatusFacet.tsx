// .../features/personas/src/ChatStatusFacet.tsx
"use client";

import {
  CHAT_STATUS_ICON_PRESETS,
  CHAT_STATUS_KINDS,
  CHAT_STATUS_WORD_PRESETS,
  chatStatusBlank,
  resolveChatStatus,
  type ChatStatusConfig,
  type StatusIconSet,
  type StatusWordPair,
} from "@agentic-toolkit/data/personas";
import { TypingIndicator } from "@agentic-toolkit/persona/chat";
import { Field, FieldGroup } from "@agentic-toolkit/ui/blocks";
import { Checkbox } from "@agentic-toolkit/ui/components/checkbox";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import { useEffect, useMemo, useState } from "react";
import { CommaListInput } from "./CommaListInput";
import { RowsField } from "./RowsField";

const DEFAULT_TINT = { color: "#a78bfa", applies: "both" } as const;

/** The glyph list is edited as one string. `Array.from` so an astral-plane character counts
 *  as one frame rather than two halves of a surrogate pair; whitespace is dropped because a
 *  blank frame reads as a dropped animation, not as a deliberate pause. */
function framesFromText(text: string): string[] {
  return Array.from(text).filter((c) => c.trim() !== "");
}

/** Cycles the preview between working and settled so the author sees BOTH lines without
 *  having to imagine the second one — the settled word is the half no rule can derive. */
function usePreviewPulse(): boolean {
  const [typing, setTyping] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setTyping((t) => !t), 4000);
    return () => clearInterval(id);
  }, []);
  return typing;
}

/**
 * Chat status authoring: the words the persona uses for what it is doing, and the glyph it
 * animates through. This is chat UI, not personality — it is its own topic for that reason.
 */
export function ChatStatusFacet({
  value,
  onChange,
}: {
  value: ChatStatusConfig | null;
  onChange: (next: ChatStatusConfig | null) => void;
}) {
  // MEMOIZED, and it must stay that way. `chatStatusBlank()` deep-copies — it returns fresh
  // arrays on every call — so a bare `value ?? chatStatusBlank()` produces a new object
  // identity on EVERY render whenever `value` is null. That would silently defeat the
  // `preview` memo below, which lists `cfg` as a dependency, and through it the renderer's
  // shuffle bag: `TypingIndicator` keys its bag on the identity of the words array, and
  // `usePreviewPulse` re-renders this component every 4 seconds. The visible symptom is the
  // preview word jumping at random for exactly the persona that has no config yet — the
  // "it looks random" failure this whole feature exists to avoid.
  const cfg = useMemo(() => value ?? chatStatusBlank(), [value]);
  const patch = (p: Partial<ChatStatusConfig>) => onChange({ ...cfg, ...p });

  const [previewKind, setPreviewKind] = useState<string>(CHAT_STATUS_KINDS[0]);
  const typing = usePreviewPulse();
  // Memoized on the resolved inputs: the renderer keys its shuffle bag on the identity of
  // the words array, so a fresh array each render would redraw the word every render.
  const preview = useMemo(() => resolveChatStatus(cfg, previewKind), [cfg, previewKind]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-4">
      <p className="text-xs text-apt-text-muted">
        While this persona works, the chat shows a glyph and a word — &ldquo;thinking…&rdquo;,
        settling to &ldquo;thought for 8s&rdquo;. Both words are yours to write; nothing is
        guessed from the first one.
      </p>

      <FieldGroup title="Preview" className="flex-col gap-2">
        <Field label="Doing">
          <Select value={previewKind} onChange={(e) => setPreviewKind(e.target.value)}>
            {CHAT_STATUS_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </Select>
        </Field>
        {/* Its own font and spacing: the chat package's stylesheet is not loaded on every
            site that hosts this editor, and an unstyled preview would misrepresent the result. */}
        <div className="flex min-h-[2rem] items-center gap-2 rounded border border-apt-border px-3 py-2 font-mono text-sm">
          <TypingIndicator
            isTyping={typing}
            labels={preview.words}
            frames={preview.frames}
            tint={preview.tint}
          />
        </div>
      </FieldGroup>

      <RowsField<StatusWordPair>
        label="Words"
        hint="Present tense while it works, past tense once it settles. Tags say what the word is for — leave them empty for a word that fits anything."
        value={cfg.words}
        onChange={(words) => patch({ words })}
        blankRow={() => ({ tags: [], present: "", past: "" })}
        addLabel="Add word pair"
        renderRow={(row, set) => (
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 gap-1">
              <Input
                aria-label="Present tense"
                placeholder="thinking"
                value={row.present}
                onChange={(e) => set({ ...row, present: e.target.value })}
              />
              <Input
                aria-label="Past tense"
                placeholder="thought"
                value={row.past}
                onChange={(e) => set({ ...row, past: e.target.value })}
              />
            </div>
            <CommaListInput
              label="Word tags"
              placeholder="think, research"
              value={row.tags}
              onChange={(tags) => set({ ...row, tags })}
            />
          </div>
        )}
      />

      <Field label="Add a preset word pair">
        <Select
          value=""
          onChange={(e) => {
            const preset = CHAT_STATUS_WORD_PRESETS.find((p) => p.present === e.target.value);
            // Appended, never merged over: presets are a library to pick from, and nothing
            // rewrites a persona that already exists.
            if (preset) patch({ words: [...cfg.words, { ...preset, tags: [...preset.tags] }] });
          }}
        >
          <option value="">Choose…</option>
          {CHAT_STATUS_WORD_PRESETS.map((p) => (
            <option key={p.present} value={p.present}>
              {p.present} / {p.past}
              {p.tags.length > 0 ? ` — ${p.tags.join(", ")}` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <RowsField<StatusIconSet>
        label="Glyphs"
        hint="The characters the spinner animates through, in order. Tags work the same way as they do for words."
        value={cfg.icons}
        onChange={(icons) => patch({ icons })}
        blankRow={() => ({ tags: [], frames: [] })}
        addLabel="Add glyph set"
        renderRow={(row, set) => (
          <div className="flex min-w-0 flex-col gap-1">
            <Input
              aria-label="Glyphs"
              placeholder="oO⊙◉"
              value={row.frames.join("")}
              onChange={(e) => set({ ...row, frames: framesFromText(e.target.value) })}
            />
            <CommaListInput
              label="Glyph tags"
              placeholder="search"
              value={row.tags}
              onChange={(tags) => set({ ...row, tags })}
            />
          </div>
        )}
      />

      <Field label="Add a preset glyph set">
        <Select
          value=""
          onChange={(e) => {
            const preset = CHAT_STATUS_ICON_PRESETS.find((p) => p.name === e.target.value);
            if (preset) patch({ icons: [...cfg.icons, { tags: [], frames: [...preset.frames] }] });
          }}
        >
          <option value="">Choose…</option>
          {CHAT_STATUS_ICON_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} — {p.frames.join("")}
            </option>
          ))}
        </Select>
      </Field>

      <FieldGroup title="Tint" className="flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={!!cfg.tint}
            aria-label="Tint the status line"
            onCheckedChange={(checked) =>
              patch({ tint: checked === true ? { ...DEFAULT_TINT } : undefined })
            }
          />
          <span>Tint the status line</span>
        </div>
        {cfg.tint ? (
          <div className="flex flex-wrap gap-3">
            <Field label="Colour" className="min-w-[9rem] flex-1">
              <Input
                type="color"
                aria-label="Tint colour"
                value={cfg.tint.color}
                onChange={(e) => patch({ tint: { ...cfg.tint!, color: e.target.value } })}
              />
            </Field>
            <Field label="Applies to" className="min-w-[9rem] flex-1">
              <Select
                aria-label="Tint applies to"
                value={cfg.tint.applies}
                onChange={(e) =>
                  patch({
                    tint: { ...cfg.tint!, applies: e.target.value as "words" | "icons" | "both" },
                  })
                }
              >
                <option value="both">Words and glyph</option>
                <option value="words">Words only</option>
                <option value="icons">Glyph only</option>
              </Select>
            </Field>
          </div>
        ) : null}
      </FieldGroup>
    </div>
  );
}
