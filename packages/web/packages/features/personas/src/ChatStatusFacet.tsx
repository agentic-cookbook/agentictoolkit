// .../features/personas/src/ChatStatusFacet.tsx
"use client";

import {
  CHAT_STATUS_ICON_PRESETS,
  CHAT_STATUS_KINDS,
  CHAT_STATUS_WORD_PRESETS,
  parseChatStatusDraft,
  resolveChatStatus,
  type ChatStatusConfig,
  type StatusIconSet,
  type StatusWordPair,
} from "@agentic-toolkit/data/personas";
import { TypingIndicator } from "@agentic-toolkit/persona/chat";
// The persona toolkit's own chat stylesheet, loaded here rather than assumed present on the
// host page. `.pc-thinking--done`'s muted grey — the whole point of `usePreviewPulse`, which
// exists to show the author BOTH the running line and the settled one — lives only in this
// sheet. Without it, both halves of the pulse rendered with the same (unstyled) colour and
// the preview proved nothing. This crosses to `@agenticdevelopertoolkit/*` through
// `@agentic-toolkit/persona`, the one package that owns that crossing (see this repo's
// `.claude/CLAUDE.md`) — `features/personas` must never name that scope directly.
import "@agentic-toolkit/persona/css/chat/base.css";
import { Field, FieldGroup } from "@agenticdevelopertoolkit/ui/blocks";
import { Checkbox } from "@agenticdevelopertoolkit/ui/components/checkbox";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { useEffect, useMemo, useState } from "react";
import { CommaListInput } from "./CommaListInput";
import { RowsField } from "./RowsField";

const DEFAULT_TINT = { color: "#a78bfa", applies: "both" } as const;

/** The glyph list is edited as one string, split into frames by GRAPHEME, not code point.
 *  `Array.from` splits at the code-point boundary, which is a smaller unit than what a user
 *  perceives as "one character": `❤️` (heart + variation selector) becomes two frames, a ZWJ
 *  emoji like `👨‍💻` becomes three, and a flag like `🇺🇸` becomes two regional-indicator
 *  letter boxes. `frames.join("")` re-glues them for display (`:174` below), so the field
 *  LOOKS correct while the shipped animation stutters through frames that render as nothing
 *  or as the wrong half of a combined glyph. `Intl.Segmenter`'s grapheme granularity is the
 *  actual "what a person would call one character" boundary; `Array.from` is the fallback for
 *  a runtime that lacks it (all evergreen browsers and Node have it, so this is a floor, not
 *  an expected path). Whitespace is still dropped because a blank frame reads as a dropped
 *  animation, not as a deliberate pause. */
function framesFromText(text: string): string[] {
  const graphemes =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment)
      : Array.from(text);
  return graphemes.filter((c) => c.trim() !== "");
}

/** `<input type="color">` coerces anything it cannot parse to #000000, so a stored `#fff`,
 *  `rebeccapurple` or `hsl(...)` — all accepted by `parseTint` and all painted correctly by
 *  the indicator — would show as black and be written back as black on the next change. The
 *  text field is the authoritative control; the swatch is a convenience that shows black only
 *  when it truly cannot represent the value. */
function hexForSwatch(color: string): string {
  const short = /^#([0-9a-fA-F]{3})$/.exec(color);
  if (short) {
    const [, digits] = short;
    return `#${digits!.split("").map((c) => c + c).join("")}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000";
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
  // `unknown`, on purpose, not `ChatStatusConfig | null`: `value` is the stored `chat_status`
  // jsonb blob, and per the spec's boundary rule it is untrusted at every client boundary and
  // narrowed exactly once, through `parseChatStatusDraft` below. A typed `ChatStatusConfig |
  // null` here would let `tsc` believe the shape without anyone having checked it, which is
  // exactly how this boundary got skipped once already.
  value: unknown;
  onChange: (next: ChatStatusConfig | null) => void;
}) {
  // MEMOIZED, and it must stay that way. `parseChatStatusDraft` builds fresh `words`/`icons`
  // arrays on every call — including when `value` is already well-formed, not only when it is
  // missing — so a bare `parseChatStatusDraft(value)` written inline would produce a new
  // object identity on EVERY render. That would silently defeat the `preview` memo below,
  // which lists `cfg` as a dependency, and through it the renderer's shuffle bag:
  // `TypingIndicator` keys its bag on the identity of the words array, and `usePreviewPulse`
  // re-renders this component every 4 seconds. The visible symptom is the preview word
  // jumping at random on every pulse — the "it looks random" failure this whole feature
  // exists to avoid.
  //
  // `parseChatStatusDraft`, not `parseChatStatus`: `cfg.words`/`cfg.icons` are fed straight
  // back down as the CONTROLLED value of `RowsField`, and `parseChatStatus` is a STORAGE
  // validator — it drops a word missing a half, drops a glyph set with no frames, and trims
  // text. Those are the right rules for a blob arriving from the database and exactly the
  // wrong ones for a form, because every intermediate authoring state (a freshly appended
  // blank row, a Past field cleared to retype it, a trailing space mid-word) is one of the
  // rows or characters `parseChatStatus` drops. Round-tripping an edit through it made "Add
  // word pair" and "Add glyph set" permanent no-ops and made a space untypeable.
  // `parseChatStatusDraft` narrows the same untrusted `unknown` shape and is just as total
  // (never throws, degrades a malformed shape to `chatStatusBlank()`'s rows) — so a stored
  // blob that does not match `ChatStatusConfig` still cannot take `RowsField`'s
  // `cfg.words.map(...)` / `cfg.icons.map(...)` down with it — but it preserves incomplete
  // rows and verbatim text instead of dropping them. Saving one is harmless: `parseChatStatus`
  // drops it again on the way back to storage.
  const cfg = useMemo(() => parseChatStatusDraft(value), [value]);
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
        {/* The chat stylesheet imported at the top of this file supplies `.pc-thinking--done`'s
            muted grey, so the settled half of the pulse (below) actually reads as settled here
            instead of matching the running line's colour — without it, `usePreviewPulse`'s two
            states rendered identically and the preview proved nothing. */}
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
              {/* The text field is authoritative and accepts anything `parseTint` does
                  (`#fff`, `rebeccapurple`, `hsl(...)`) — the swatch beside it is a picker
                  convenience, not the source of truth, because `<input type="color">` can
                  only ever hold a 6-digit hex and silently mangles everything else. */}
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Tint colour"
                  value={cfg.tint.color}
                  onChange={(e) => patch({ tint: { ...cfg.tint!, color: e.target.value } })}
                />
                <Input
                  type="color"
                  aria-label="Tint colour swatch"
                  value={hexForSwatch(cfg.tint.color)}
                  onChange={(e) => patch({ tint: { ...cfg.tint!, color: e.target.value } })}
                  className="h-9 w-9 shrink-0 p-1"
                />
              </div>
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
