"use client";

import type { ReactNode } from "react";

/**
 * The two pieces of a token detail leaf that both families render identically: the fact list and
 * the one-time secret reveal. Shared so the reveal's promise ("shown once") is worded once — the
 * two sections mint different principals, but the guarantee is the same sentence and must not
 * drift into two.
 */

/** One label/value row. `value` is null/undefined for "not set", rendered as an em dash. */
export function TokenFact({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  /** Render the value in the mono face — for ids, prefixes and rdids. */
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
        {label}
      </dt>
      <dd className={`break-all text-sm text-apt-text${mono ? " font-mono" : ""}`}>
        {value == null || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

export function TokenFacts({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</dl>;
}

/** A timestamp as a local string, or the caller's word for "never". */
export function whenOr(iso: string | null | undefined, never: string): string {
  return iso ? new Date(iso).toLocaleString() : never;
}

/**
 * The minted secret, shown ONCE. Rendered inside the detail of the token it belongs to, and only
 * for that token: a reveal that outlives its row would sit next to a different token's facts and
 * invite the reader to attribute it there.
 */
export function RevealedSecret({ secret }: { secret: string }) {
  return (
    <p className="break-all rounded-md border border-apt-gold/40 bg-apt-gold/10 p-3 text-sm">
      Copy now — shown once: <code className="font-mono">{secret}</code>
    </p>
  );
}
