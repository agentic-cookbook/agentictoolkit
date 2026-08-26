"use client";

import { useState } from "react";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { intFieldOr, intText, optionalIntField, optionalIntText } from "./fields";

/**
 * Whole-number fields whose RAW TEXT lives here rather than in the draft.
 *
 * `<Input type="number">` cannot hold a partial number. While you type `-30` the box passes
 * through a lone `-`, and the DOM reports that as `value === ""` — so a control that parsed
 * on every keystroke wrote its fallback straight back into the box and ate the minus. A
 * negative number was untypeable, and the sign vanished without a word: the operator typed
 * `-30` and saved `30`. `game-schema.md`'s own canonical effect is fireball's `hp / add /
 * -30`, so that defect is the difference between a spell that deals 30 damage and one that
 * heals 30.
 *
 * The fix is to stop round-tripping the text through a number on every keystroke: the text
 * is `type="text"` state here, the draft holds the parsed value, and text that is not a
 * number yet parses to `NaN`, which the feature's validators reject by name. The box shows
 * what you typed; an unfinished number blocks Save with a reason instead of saving a
 * different number silently.
 *
 * No `inputMode="numeric"`: iOS's numeric keypad has no minus key, which is the one
 * character this file exists to let you type.
 */

/** Raw text alongside the parsed value, re-synced only on an EXTERNAL change. */
function useRawText<T>(value: T, format: (value: T) => string) {
  const [text, setText] = useState(() => format(value));
  const [emitted, setEmitted] = useState<T>(value);

  // `Object.is`, not `!==`: `NaN !== NaN` would re-sync on every render of an unfinished
  // number and wipe the text being typed. When the draft's value moved without us — a
  // re-hydrate after save, a record switch that did not remount — adopt it. Adjusting
  // state during render is React's own answer to derived state; it re-runs this component
  // before anything paints.
  if (!Object.is(value, emitted)) {
    setEmitted(value);
    setText(format(value));
  }

  return {
    text,
    /** Record what was typed AND what it parsed to, so the value coming back through
     *  props reads as ours rather than as an external change. */
    onText(raw: string, parsed: T) {
      setText(raw);
      setEmitted(parsed);
    },
  };
}

export function IntegerInput({
  id,
  value,
  /** The column's default, used when the box is emptied. */
  fallback,
  placeholder,
  onChange,
}: {
  id: string;
  value: number;
  fallback: number;
  placeholder?: string;
  onChange: (next: number) => void;
}) {
  const { text, onText } = useRawText(value, intText);
  return (
    <Input
      id={id}
      type="text"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const parsed = intFieldOr(raw, fallback);
        onText(raw, parsed);
        onChange(parsed);
      }}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

/** The same control for a NULLABLE column, where an empty box is the answer `null`. */
export function OptionalIntegerInput({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  value: number | null;
  placeholder?: string;
  onChange: (next: number | null) => void;
}) {
  const { text, onText } = useRawText(value, optionalIntText);
  return (
    <Input
      id={id}
      type="text"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const parsed = optionalIntField(raw);
        onText(raw, parsed);
        onChange(parsed);
      }}
      autoComplete="off"
      spellCheck={false}
    />
  );
}
