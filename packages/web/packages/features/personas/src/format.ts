// Package-local formatting helpers shared by the persona table, services list, and
// permissions panel — ONE owner so the same surface can't render timestamps three ways
// (the pre-extraction copies had already drifted on the invalid-date fallback).

/** A wire timestamp for display; em-dash for absent or unparseable values. */
export function fmtDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
