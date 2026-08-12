import { describe, it, expect } from "vitest";
import type { UsageRow } from "@agentic-toolkit/data/profile";

import { capsFor, capPercent, formatBytes, formatCost, formatCount, groupUsage } from "./format";

const UNCAPPED = {
  quotaRequests: null,
  quotaBytes: null,
  quotaTokens: null,
  quotaCostMicros: null,
  enforced: false,
};

function row(over: Partial<UsageRow> & Pick<UsageRow, "kind">): UsageRow {
  return {
    kind: over.kind,
    scope: over.scope ?? "user",
    principalId: over.principalId ?? "p1",
    label: over.label ?? "Someone",
    periodStart: over.periodStart ?? "2026-07-01",
    periodDays: over.periodDays ?? 30,
    tier: over.tier ?? "free",
    limits: over.limits ?? UNCAPPED,
    requests: over.requests ?? 0,
    bytes: over.bytes ?? 0,
    tokens: over.tokens ?? 0,
    costMicros: over.costMicros ?? 0,
  };
}

describe("formatCost", () => {
  // The reason this function exists: a handful of chat turns is worth thousands of µUSD, and
  // rounding those to $0.00 would tell the user nothing was billed when something was.
  it("keeps four decimals below a cent so real spend never reads as zero", () => {
    expect(formatCost(700)).toBe("$0.0007");
    expect(formatCost(9_999)).toBe("$0.0100");
  });

  it("reads as ordinary money at a cent and above", () => {
    expect(formatCost(10_000)).toBe("$0.01");
    expect(formatCost(1_234_567)).toBe("$1.23");
    expect(formatCost(12_345_678_901)).toBe("$12,345.68");
  });

  it("shows an untouched counter as $0.00, not $0.0000", () => {
    expect(formatCost(0)).toBe("$0.00");
  });
});

describe("formatBytes / formatCount", () => {
  it("scales bytes binary and keeps whole bytes whole", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("groups counts", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
  });
});

describe("capsFor", () => {
  const CAPPED = {
    quotaRequests: 200,
    quotaBytes: 1024,
    quotaTokens: 1_000_000,
    quotaCostMicros: 500_000,
    enforced: true,
  };

  // Which caps bite depends on the key's ROLE, not on the row: an acting key is refused on
  // requests/bytes, while tokens/spend are reserved against the BILLING key.
  it("gives an acting key only its request and byte caps", () => {
    const caps = capsFor(row({ kind: "self", limits: CAPPED }));
    expect(caps.map((c) => c.key)).toEqual(["requests", "bytes"]);
  });

  it("gives the ecosystem key only its token and spend caps", () => {
    const caps = capsFor(row({ kind: "ecosystem", scope: "ecosystem", limits: CAPPED }));
    expect(caps.map((c) => c.key)).toEqual(["tokens", "cost"]);
  });

  it("treats a null quota as uncapped rather than a zero cap", () => {
    expect(capsFor(row({ kind: "self" }))).toEqual([]);
    expect(capsFor(row({ kind: "ecosystem", scope: "ecosystem" }))).toEqual([]);
  });

  it("clamps a cap's fill to 100 and survives a zero cap", () => {
    const [requests] = capsFor(
      row({ kind: "self", requests: 400, limits: { ...CAPPED, quotaBytes: null } }),
    );
    expect(requests && capPercent(requests)).toBe(100);
    const [zeroed] = capsFor(
      row({ kind: "self", requests: 0, limits: { ...UNCAPPED, quotaRequests: 0 } }),
    );
    expect(zeroed && capPercent(zeroed)).toBe(100);
  });
});

describe("groupUsage", () => {
  const rows: UsageRow[] = [
    row({ kind: "self", principalId: "u1", label: "Me", requests: 10, tokens: 100, costMicros: 5 }),
    row({ kind: "member", principalId: "u2", label: "You", requests: 3, tokens: 30, costMicros: 2 }),
    row({ kind: "token", scope: "token", principalId: "t1", label: "CI", requests: 7, bytes: 900 }),
    row({
      kind: "persona",
      scope: "persona",
      principalId: "pa1",
      label: "Ada",
      requests: 1000,
      tokens: 9999,
      costMicros: 4242,
    }),
    row({
      kind: "ecosystem",
      scope: "ecosystem",
      principalId: "eco",
      label: "Platform",
      tokens: 50_000,
      costMicros: 90_000,
    }),
  ];

  // The whole point of the split: a persona row double-counts turns already attributed to the
  // person who ran them, and the ecosystem row is a different axis — neither may be added in.
  it("totals only the acting rows, never personas or the ecosystem", () => {
    const view = groupUsage(rows);
    expect(view.totals).toEqual({ requests: 20, bytes: 900, tokens: 130, costMicros: 7 });
  });

  it("puts personas in their own section and pulls the ecosystem row out entirely", () => {
    const view = groupUsage(rows);
    expect(view.sections.map((s) => s.id)).toEqual(["people", "tokens", "personas"]);
    expect(view.sections.find((s) => s.id === "personas")?.rows).toHaveLength(1);
    expect(view.ecosystem?.principalId).toBe("eco");
  });

  // An application row is an acting key that overlaps nothing, so the reason it stays out of the
  // total is not double-counting: the API returns it to platform admins only, covering the whole
  // ecosystem, and a workspace total that absorbed it would report other tenants' traffic as this
  // workspace's. It must still REACH a section — a kind matching no filter is dropped silently,
  // which is exactly how these rows stayed invisible.
  it("gives applications their own section and keeps them out of the total", () => {
    const app = row({
      kind: "application",
      scope: "application",
      principalId: "app1",
      label: "Billing sync",
      requests: 500,
      bytes: 4_000,
      tokens: 60,
      costMicros: 11,
    });
    const view = groupUsage([...rows, app]);
    expect(view.sections.map((s) => s.id)).toEqual([
      "people",
      "tokens",
      "personas",
      "applications",
    ]);
    expect(view.sections.find((s) => s.id === "applications")?.rows).toEqual([app]);
    expect(view.totals).toEqual({ requests: 20, bytes: 900, tokens: 130, costMicros: 7 });
  });

  it("names the section 'You' for a lone self row and 'People' for a roster", () => {
    expect(groupUsage([rows[0]!]).sections[0]?.title).toBe("You");
    expect(groupUsage([rows[0]!, rows[1]!]).sections[0]?.title).toBe("People");
  });

  it("reports the period from the rows, and omits it when there are none", () => {
    expect(groupUsage(rows).period).toEqual({ start: "2026-07-01", days: 30 });
    const empty = groupUsage([]);
    expect(empty.period).toBeUndefined();
    expect(empty.sections).toEqual([]);
    expect(empty.totals).toEqual({ requests: 0, bytes: 0, tokens: 0, costMicros: 0 });
  });
});
