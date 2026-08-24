// The one thing worth asserting here is the ZONE, not the formatting: a naive
// `YYYY-MM-DD HH:MM:SS` from a Drizzle `mode: 'string'` column is UTC, and `new Date()` reads it as
// local. Comparing the parsed instant against the same moment written with an explicit `Z` catches
// that without pinning the test to a locale or a timezone.
import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, parseBackendTimestamp } from "../lib/timestamps";

describe("parseBackendTimestamp", () => {
  it("reads a zone-less backend timestamp as UTC, not as local time", () => {
    const naive = parseBackendTimestamp("2026-08-17 03:15:00");
    expect(naive?.toISOString()).toBe("2026-08-17T03:15:00.000Z");
  });

  it("keeps fractional seconds", () => {
    expect(parseBackendTimestamp("2026-08-17 03:15:00.123456")?.toISOString()).toBe(
      "2026-08-17T03:15:00.123Z",
    );
  });

  it("leaves a value that already carries a zone alone", () => {
    expect(parseBackendTimestamp("2026-08-17T03:15:00.000Z")?.toISOString()).toBe(
      "2026-08-17T03:15:00.000Z",
    );
    expect(parseBackendTimestamp("2026-08-17T04:15:00+01:00")?.toISOString()).toBe(
      "2026-08-17T03:15:00.000Z",
    );
  });

  it("answers null rather than an Invalid Date", () => {
    expect(parseBackendTimestamp("not a timestamp")).toBeNull();
  });
});

describe("formatters", () => {
  it("fall back rather than printing Invalid Date", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("garbage")).toBe("—");
    expect(formatDateTime(null)).toBe("—");
    // A wide column keeps the raw value, which tells an operator more than an em dash.
    expect(formatDateTime("garbage")).toBe("garbage");
  });

  it("render something for a valid value", () => {
    expect(formatDate("2026-08-17 03:15:00")).not.toBe("—");
    expect(formatDateTime("2026-08-17 03:15:00")).not.toBe("—");
  });
});
