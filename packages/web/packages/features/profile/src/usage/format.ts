import type { UsageRow } from "@agentic-toolkit/data/profile";

/**
 * Shaping and formatting for the Usage panel — kept out of the component so the two things
 * that are easy to get wrong (which rows may be added up, and how µUSD reads as money) are
 * plain functions with plain tests.
 */

// ── Quantities ─────────────────────────────────────────────────────────────────

/** Calls / tokens — a plain grouped integer. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** HTTP bytes, binary-scaled. Whole bytes stay whole; anything larger gets one decimal. */
export function formatBytes(n: number): string {
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rendered = unit === 0 ? String(Math.round(value)) : value.toFixed(1);
  return [rendered, BYTE_UNITS[unit]].join(" ");
}

/**
 * Micro-dollars as money. A metering page routinely shows spend BELOW a cent — a handful of
 * chat turns is worth thousands of µUSD, not millions — and rounding those to `$0.00` would
 * read as "nothing was billed" when something was. Sub-cent amounts therefore keep four
 * decimals; everything else is ordinary currency.
 */
export function formatCost(micros: number): string {
  const dollars = micros / 1_000_000;
  if (micros === 0) return "$0.00";
  if (Math.abs(micros) < 10_000) return ["$", dollars.toFixed(4)].join("");
  return ["$", dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })].join("");
}

// ── Caps ───────────────────────────────────────────────────────────────────────

export type CapKey = "requests" | "bytes" | "tokens" | "cost";

export interface UsageCap {
  key: CapKey;
  label: string;
  used: number;
  cap: number;
  format: (n: number) => string;
}

/**
 * Every quantity that CAN carry a cap, with the key role whose cap actually bites on it. That role
 * split is the whole rule: an acting key (a user, a token, a persona) is refused on the request and
 * byte quotas by the auth gate, while the token and spend quotas bite only on the BILLING key the
 * turn meter reserves against. Drawing a progress bar for a cap a row is merely RECORDED against
 * would invent a limit that will never fire.
 *
 * Declared once, as data, so {@link capFor} and {@link capsFor} cannot drift apart — and so
 * `capsFor`'s order stays the table's column order by construction.
 */
const CAP_SPECS: {
  key: CapKey;
  label: string;
  role: "acting" | "billing";
  used: (row: UsageRow) => number;
  quota: (limits: UsageRow["limits"]) => number | null;
  format: (n: number) => string;
}[] = [
  { key: "requests", label: "Calls", role: "acting", used: (r) => r.requests, quota: (l) => l.quotaRequests, format: formatCount },
  { key: "bytes", label: "Data", role: "acting", used: (r) => r.bytes, quota: (l) => l.quotaBytes, format: formatBytes },
  { key: "tokens", label: "Tokens", role: "billing", used: (r) => r.tokens, quota: (l) => l.quotaTokens, format: formatCount },
  { key: "cost", label: "Spend", role: "billing", used: (r) => r.costMicros, quota: (l) => l.quotaCostMicros, format: formatCost },
];

/**
 * The cap on ONE quantity for this row, or `null` when nothing can refuse it — either the quantity
 * belongs to the other key role, or the tier leaves it uncapped (a `null` quota is UNCAPPED, not
 * zero, so it yields no bar at all).
 *
 * This is what a table cell asks, and it is deliberately not `capsFor(row).find(...)`: a cell that
 * built the whole list to keep one entry would allocate and discard it once per quantity per row.
 */
export function capFor(row: UsageRow, key: CapKey): UsageCap | null {
  const spec = CAP_SPECS.find((s) => s.key === key);
  if (!spec || spec.role !== (row.kind === "ecosystem" ? "billing" : "acting")) return null;
  const cap = spec.quota(row.limits);
  if (cap == null) return null;
  return { key, label: spec.label, used: spec.used(row), cap, format: spec.format };
}

/** Every cap that can refuse something for this row, in column order. */
export function capsFor(row: UsageRow): UsageCap[] {
  return CAP_SPECS.flatMap((spec) => capFor(row, spec.key) ?? []);
}

/** A cap's fill as a percentage, clamped to 100 and safe against a zero cap. */
export function capPercent(cap: UsageCap): number {
  if (cap.cap <= 0) return 100;
  return Math.min(100, (cap.used / cap.cap) * 100);
}

// ── Sections ───────────────────────────────────────────────────────────────────

export interface UsageSection {
  id: string;
  title: string;
  description?: string;
  rows: UsageRow[];
}

export interface UsageTotals {
  requests: number;
  bytes: number;
  tokens: number;
  costMicros: number;
}

export interface UsageView {
  sections: UsageSection[];
  /** Summed over the ACTING rows only — see {@link groupUsage}. */
  totals: UsageTotals;
  /** The billing key, when the caller is allowed to see it (platform admins). */
  ecosystem?: UsageRow;
  /** The current accounting window, taken from the rows themselves. */
  period?: { start: string; days: number };
}

const ZERO: UsageTotals = { requests: 0, bytes: 0, tokens: 0, costMicros: 0 };

/**
 * Split the rows into the sections the panel renders, and total only what may honestly be
 * totalled.
 *
 * A request has exactly ONE acting key, so the people rows (`self`, `member`) and the token
 * rows partition the traffic between them and adding them up is correct. A PERSONA row does
 * not: it collects both the traffic of persona-scoped tokens and the token/spend attribution
 * of every chat turn run on that persona — including turns already counted under the person
 * who ran them. Personas are therefore their own section and stay out of the total, and the
 * ecosystem row (a different axis entirely — the tenant realm's bill) is pulled out too.
 */
export function groupUsage(rows: UsageRow[]): UsageView {
  const people = rows.filter((r) => r.kind === "self" || r.kind === "member");
  const tokens = rows.filter((r) => r.kind === "token");
  const personas = rows.filter((r) => r.kind === "persona");
  const ecosystem = rows.find((r) => r.kind === "ecosystem");

  const totals = [...people, ...tokens].reduce<UsageTotals>(
    (acc, r) => ({
      requests: acc.requests + r.requests,
      bytes: acc.bytes + r.bytes,
      tokens: acc.tokens + r.tokens,
      costMicros: acc.costMicros + r.costMicros,
    }),
    ZERO,
  );

  const sections: UsageSection[] = [];
  if (people.length > 0) {
    sections.push({
      id: "people",
      title: people.length === 1 && people[0]?.kind === "self" ? "You" : "People",
      rows: people,
    });
  }
  if (tokens.length > 0) {
    sections.push({
      id: "tokens",
      title: "API tokens",
      description: "Traffic made with a personal token. A persona's own token is metered under that persona instead.",
      rows: tokens,
    });
  }
  if (personas.length > 0) {
    sections.push({
      id: "personas",
      title: "Personas",
      description: "Counted separately: a persona also collects the turns other people ran on it, so these overlap the rows above and are not part of the total.",
      rows: personas,
    });
  }

  const first = rows[0];
  return {
    sections,
    totals,
    ecosystem,
    period: first ? { start: first.periodStart, days: first.periodDays } : undefined,
  };
}
