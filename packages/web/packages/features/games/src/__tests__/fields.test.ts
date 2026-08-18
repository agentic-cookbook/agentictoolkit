import { describe, expect, it } from "vitest";
import {
  INT4_MAX,
  INT4_MIN,
  intFieldOr,
  intText,
  optionalIntField,
  optionalIntText,
  optionalWholeNumberProblem,
  wholeNumberProblem,
} from "../fields";

describe("intFieldOr", () => {
  it("falls back for an EMPTY field, which is a real answer", () => {
    expect(intFieldOr("", 1)).toBe(1);
    expect(intFieldOr("   ", 0)).toBe(0);
  });

  // Empty and unreadable are different answers. `-` is a number half-typed, not a zero:
  // collapsing it to the fallback is what ate the minus sign and turned a spell that deals
  // 30 damage into one that heals 30. NaN is refused by every validator by name.
  it("refuses text that is not a number YET, rather than inventing one", () => {
    expect(intFieldOr("-", 0)).toBeNaN();
    expect(intFieldOr("abc", 1)).toBeNaN();
    expect(intFieldOr("--3", 0)).toBeNaN();
    expect(intFieldOr("1e", 0)).toBeNaN();
  });

  it("keeps whole numbers, including negatives", () => {
    expect(intFieldOr("3", 0)).toBe(3);
    expect(intFieldOr("-2", 0)).toBe(-2);
    expect(intFieldOr("-30", 0)).toBe(-30);
  });

  // The box goes on showing what was typed, so a value quietly rewritten under it is the
  // same "typed ≠ saved" defect the raw-text control exists to prevent. `Number()` reads
  // all four of these; this column does not.
  it("refuses a decimal, an exponent, a hex literal and an infinity rather than rewriting them", () => {
    expect(intFieldOr("1.9", 0)).toBeNaN();
    expect(intFieldOr("1e3", 0)).toBeNaN();
    expect(intFieldOr("0x1f", 0)).toBeNaN();
    expect(intFieldOr("Infinity", 0)).toBeNaN();
  });

  // Every one of these columns is an int4, so a number JS is perfectly happy with is
  // still a failed INSERT.
  it("refuses a number too big for the int4 column it is bound for", () => {
    expect(intFieldOr("99999999999999999999", 0)).toBeNaN();
    expect(intFieldOr(String(INT4_MAX + 1), 0)).toBeNaN();
    expect(intFieldOr(String(INT4_MIN - 1), 0)).toBeNaN();
    expect(intFieldOr(String(INT4_MAX), 0)).toBe(INT4_MAX);
    expect(intFieldOr(String(INT4_MIN), 0)).toBe(INT4_MIN);
  });
});

// Out-of-range and unreadable arrive at a validator as the same NaN, so the one sentence
// it says has to cover both — "must be a whole number" alone leaves an operator staring at
// a box full of digits.
describe("the problem sentence", () => {
  it("names the range, and the optional form says empty is allowed", () => {
    expect(wholeNumberProblem("Value")).toContain(String(INT4_MAX));
    expect(wholeNumberProblem("Value")).toContain(String(INT4_MIN));
    expect(wholeNumberProblem("Value").startsWith("Value ")).toBe(true);
    expect(optionalWholeNumberProblem("Duration")).toContain("or empty");
    expect(wholeNumberProblem("Duration")).not.toContain("or empty");
  });
});

describe("intText", () => {
  it("shows a number, and an unfinished one as nothing of its own", () => {
    expect(intText(0)).toBe("0");
    expect(intText(-30)).toBe("-30");
    expect(intText(NaN)).toBe("");
  });
});

// `game.effects.duration` is NULLABLE, and null means "for as long as it is held" — not
// "no duration". A 0 would mean the effect expires immediately, which is a different game.
describe("optionalIntField", () => {
  it("turns an empty field into null, NEVER 0", () => {
    expect(optionalIntField("")).toBeNull();
    expect(optionalIntField("   ")).toBeNull();
    expect(optionalIntField("")).not.toBe(0);
  });

  it("keeps a typed 0 as 0, because that is a real answer", () => {
    expect(optionalIntField("0")).toBe(0);
  });

  // Not null either: "not a number yet" must not pass for "while held", which is a
  // meaning the operator never chose.
  it("refuses nonsense rather than reading it as the absent value", () => {
    expect(optionalIntField("what")).toBeNaN();
    expect(optionalIntField("-")).toBeNaN();
  });

  it("reads whole numbers, negatives included", () => {
    expect(optionalIntField("12")).toBe(12);
    expect(optionalIntField("-1")).toBe(-1);
  });

  it("holds the same line on decimals, exponents and int4 overflow", () => {
    expect(optionalIntField("1.9")).toBeNaN();
    expect(optionalIntField("1e3")).toBeNaN();
    expect(optionalIntField("99999999999999999999")).toBeNaN();
  });
});

describe("optionalIntText", () => {
  it("shows null as an empty field, so the placeholder can explain what empty means", () => {
    expect(optionalIntText(null)).toBe("");
    expect(optionalIntText(0)).toBe("0");
    expect(optionalIntText(7)).toBe("7");
    expect(optionalIntText(NaN)).toBe("");
  });
});
