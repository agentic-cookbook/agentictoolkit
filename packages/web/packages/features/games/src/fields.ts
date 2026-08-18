// Whole-number form fields, in one place because the two shapes they come in are easy
// to conflate and one of them is a correctness rule rather than a preference.
//
// `game.effects.duration` is NULLABLE, and null means "for as long as it is held" —
// NOT "no duration". An empty duration box that collapsed to `0` would say the opposite
// of what the operator left unsaid: it would mean the effect expires immediately. So an
// empty OPTIONAL field is `null`, always, and never a number.
//
// The other integer columns (`value`, `sort_order`, `amount`) are NOT NULL with a schema
// default, so an emptied box falls back to that default rather than to null.
//
// EMPTY AND UNREADABLE ARE DIFFERENT ANSWERS. An empty box is a real answer — "the
// default", or "for as long as it is held". Text that is not a number YET (`-`, `1e`,
// `--3`) is not an answer at all, and the two must not collapse together: while you type
// `-30` the box passes through the lone `-`, and a parser that answered "0" there would
// turn a spell that deals 30 damage into one that heals 30. So unreadable text parses to
// `NaN`, which every validator in this feature rejects by name (`Number.isInteger`), and
// Save stays blocked with a reason until the number is finished.
//
// WHOLE MEANS WHOLE, AND SMALL ENOUGH TO STORE. `Number()` is far more generous than these
// columns are: it reads `"1.9"`, `"1e3"` and `"0x1f"` as numbers, and truncating those to
// 1, 1000 and 31 saves a value the operator never typed while the box goes on showing what
// they did — the same "typed ≠ saved" defect the raw-text control exists to prevent, just
// quieter. And every one of these columns is an `int4`, so `"99999999999999999999"` is a
// perfectly good JS integer that the INSERT rejects. So the only readable text is an
// optionally-signed run of digits inside the signed 32-bit range; everything else is `NaN`
// and says so.

/** The inclusive bounds of a Postgres `int4`, which every integer column here is. */
export const INT4_MIN = -2147483648;
export const INT4_MAX = 2147483647;

/** Digits, optionally signed. No decimal point, no exponent, no `0x`, no `Infinity`. */
const WHOLE_NUMBER = /^-?\d+$/;

function parseWhole(text: string): number {
  if (!WHOLE_NUMBER.test(text)) return NaN;
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n < INT4_MIN || n > INT4_MAX) return NaN;
  return n;
}

/** The one sentence every integer field says when its text is not a storable whole number.
 *  It names the range because out-of-range and unreadable arrive here as the same `NaN`,
 *  and "must be a whole number" alone leaves someone staring at a box full of digits. */
export function wholeNumberProblem(label: string): string {
  return `${label} must be a whole number between ${INT4_MIN} and ${INT4_MAX}.`;
}

/** The same sentence for a field whose empty IS an answer, so it does not read as required. */
export function optionalWholeNumberProblem(label: string): string {
  return `${label} must be a whole number between ${INT4_MIN} and ${INT4_MAX}, or empty.`;
}

/** A required whole-number field's raw text.
 *
 *  - empty → the column's `fallback` default (a real answer),
 *  - a signed run of digits inside `int4` → that number,
 *  - anything else → `NaN`, so validation refuses it rather than inventing a value. */
export function intFieldOr(raw: string, fallback: number): number {
  const text = raw.trim();
  if (!text) return fallback;
  return parseWhole(text);
}

/** The text a required whole-number field shows. `NaN` is unfinished input, not a value,
 *  so it has no rendering of its own — the field's own raw text is what the operator sees
 *  while they are typing (see `IntegerInput`). */
export function intText(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

/** An OPTIONAL whole-number field's raw text. Empty is `null` — the field's absence,
 *  which for a duration is the meaningful value "for as long as it is held". Unreadable
 *  text is `NaN`, NOT null: "not a number yet" must not pass for "while held". */
export function optionalIntField(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  return parseWhole(text);
}

/** The text an optional whole-number field shows: empty for absent, never "0". */
export function optionalIntText(value: number | null): string {
  if (value === null) return "";
  return Number.isFinite(value) ? String(value) : "";
}
