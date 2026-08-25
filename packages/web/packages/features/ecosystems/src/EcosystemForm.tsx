"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { SEGMENT_RE, prefixFor, validateLeaf } from "@agentic-toolkit/adh-ui/rdid";
import { identifiersApi, type EcosystemInput } from "@agentic-toolkit/data/ecosystems";

/**
 * The live verdict on a derived identifier. In the CREATE dialog it is carried IN the
 * draft (not local state) so the dialog's sync `saveEnabled` gate reads the same value
 * the form displays; the SETTINGS pane holds it in render scope and reads it from its
 * `validate` closure instead.
 */
export type RdidAvailability =
  | "idle"
  | "checking"
  | "invalid"
  | "available"
  | "unavailable"
  | "error";

/**
 * Debounced server probe for an rdid's system-wide availability (registry.identifiers
 * is the uniqueness authority — the same key a create/rename 409s on). Pass null to
 * probe nothing (empty / grammar-invalid / unchanged identifier) → "idle". Grammar
 * validity is the CALLER's call ("invalid" never comes from here).
 */
export function useRdidAvailability(
  rdid: string | null,
): Exclude<RdidAvailability, "invalid"> {
  // Debounce the probed value so the query fires on pauses, not on every keystroke
  // (the same 350ms idiom as the hub's profile slug-availability check).
  const [debounced, setDebounced] = useState(rdid);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(rdid), 350);
    return () => clearTimeout(timer);
  }, [rdid]);

  const existsQuery = useQuery({
    queryKey: ["rdid-exists", debounced],
    queryFn: () => identifiersApi.exists(debounced as string),
    enabled: debounced != null && debounced !== "",
    retry: false,
    staleTime: 30_000,
  });

  if (rdid == null || rdid === "") return "idle";
  if (rdid !== debounced || existsQuery.isFetching) return "checking";
  if (existsQuery.data === false) return "available";
  if (existsQuery.data === true) return "unavailable";
  if (existsQuery.isError) return "error";
  return "checking";
}

/** The New-Product draft: the user edits name/slug/description; the identifier is
 *  DERIVED (the parent ecosystem's own rdid + `.<slug>`), never typed. */
export interface EcosystemCreateDraft {
  name: string;
  slug: string;
  description: string;
  rdidStatus: RdidAvailability;
}

export function ecoCreateBlank(): EcosystemCreateDraft {
  return { name: "", slug: "", description: "", rdidStatus: "idle" };
}

/** The backend's `ecosystem.ecosystems.slug` column width. The slug is ONE rdid segment,
 *  so this bounds the leaf, not the whole address. */
export const ECOSYSTEM_SLUG_MAX_LENGTH = 64;

/**
 * The parent ecosystem this create hangs under, as the caller knows it:
 *   - a string — the PARENT's own rdid (the workspace's home/infrastructure ecosystem),
 *   - `null`   — no parent; the create lands at the root,
 *   - `undefined` — not resolved YET, so no address can be previewed honestly.
 *
 * The distinction between the last two is why this is not just `string | null`: `null` is a
 * verdict (`ecosystem.<slug>` is what the server will mint), `undefined` is the absence of one,
 * and rendering a root address for an unresolved parent would show the user an address the
 * create is not going to use.
 */
export type EcosystemParentRdid = string | null | undefined;

/** The fixed identifier prefix (up to and including the final dot) a create derives from: the
 *  PARENT's own rdid plus a dot, since the parent is itself an `ecosystem.`-typed address and
 *  the type token is shared — `ecosystem.fishlamp` + `adh` ⇒ `ecosystem.fishlamp.adh`, exactly
 *  what the server derives by walking the new row's parent chain. Bare `ecosystem.` for a root
 *  create; `""` while the parent is unresolved, so nothing is asserted. */
export function ecoCreatePrefix(parentRdid: EcosystemParentRdid): string {
  if (parentRdid === undefined) return "";
  return parentRdid ? `${parentRdid}.` : prefixFor("ecosystem");
}

/** The full rdid the create will mint. */
export function ecoCreateRdid(parentRdid: EcosystemParentRdid, slug: string): string {
  return ecoCreatePrefix(parentRdid) + slug;
}

/** Whether the typed leaf is a well-formed slug: one rdid segment, within the slug column's
 *  width. On the create path this is the WHOLE grammar question — every other segment comes
 *  from the parent's own (server-minted) rdid, so the leaf is the only part a create can get
 *  wrong. */
export function ecoCreateSlugValid(slug: string): boolean {
  return validateLeaf(slug) === null && slug.length <= ECOSYSTEM_SLUG_MAX_LENGTH;
}

/** Whether every segment of an assembled rdid (owner scope + leaf) is well-formed — the same
 *  grammar bar the backend's assertRdid applies to the whole identifier. The RENAME path's
 *  check: there the scope comes from the saved row's rdid, so both halves are in play. */
export function ecoCreateRdidValid(ownerScope: string, slug: string): boolean {
  const scope = ownerScope.trim();
  const scopeOk = scope === "" || scope.split(".").every((seg) => SEGMENT_RE.test(seg));
  return scopeOk && ecoCreateSlugValid(slug);
}

/** Save-button gate: Name and Slug filled in AND the derived rdid probed available. */
export function ecoCreateReady(d: EcosystemCreateDraft): boolean {
  return d.name.trim() !== "" && d.slug.trim() !== "" && d.rdidStatus === "available";
}

/** Click-time backstop mirroring {@link ecoCreateReady} with actionable messages —
 *  Save stays disabled until ready, so these only surface if that gate is bypassed. */
export function ecoCreateValidate(
  d: EcosystemCreateDraft,
  parentRdid: EcosystemParentRdid,
): string | null {
  if (!d.name.trim()) return "Display name is required.";
  const slug = d.slug.trim();
  if (!slug) return "Slug is required.";
  if (slug.length > ECOSYSTEM_SLUG_MAX_LENGTH)
    return `Slug must be ${ECOSYSTEM_SLUG_MAX_LENGTH} characters or fewer.`;
  // Before anything that NAMES the address: with the parent unresolved `ecoCreateRdid` yields the
  // bare slug, so the grammar complaint below would quote a leaf as though it were an identifier —
  // the same category error this whole form exists to stop. It is also what the form is already
  // showing: an unresolved parent holds the status line at "Checking…", never "Invalid".
  if (parentRdid === undefined) return "Waiting for the workspace's identifier prefix.";
  if (!ecoCreateSlugValid(slug))
    return `"${ecoCreateRdid(parentRdid, slug)}" is not a valid identifier — lowercase letters, digits, and interior hyphens only.`;
  if (d.rdidStatus === "unavailable")
    return `Identifier "${ecoCreateRdid(parentRdid, slug)}" is already in use.`;
  if (d.rdidStatus !== "available") return "Waiting for the identifier availability check.";
  return null;
}

/** Map the draft to the API input. The identifier is the derived, parent-scoped rdid — an
 *  ASSERTION about the address the server will derive from (this workspace's chain, `slug`),
 *  not an address the client gets to choose. region/domain are not collected by this form
 *  (region is coming soon, domain dropped). */
export function ecoCreateToInput(
  d: EcosystemCreateDraft,
  parentRdid: EcosystemParentRdid,
): EcosystemInput {
  return {
    identifier: ecoCreateRdid(parentRdid, d.slug.trim()),
    name: d.name.trim(),
    description: d.description.trim(),
    region: "",
    domain: "",
  };
}

/**
 * The ONE ecosystem/product form layout, shared by the New-Product dialog and the
 * Settings pane so the two can't drift: labels sit left of their controls in one
 * right-aligned column; the Identifier is a read-only live derivation
 * `<prefix><slug>` with the availability status on a height-reserved line under it;
 * Geographic Region is disabled ("coming soon"); Domain is not collected.
 */
export function EcosystemFields({
  prefix,
  name,
  slug,
  description,
  region = "",
  status,
  error,
  noun = "ecosystem",
  onName,
  onSlug,
  onDescription,
}: {
  /** The fixed identifier prefix (up to and including the final dot). */
  prefix: string;
  name: string;
  slug: string;
  description: string;
  /** Shown (still disabled) so an existing row's stored region stays visible. */
  region?: string;
  status: RdidAvailability;
  error?: string | null;
  /** Lowercase entity noun for placeholder copy (the hub passes "product"). */
  noun?: string;
  onName: (v: string) => void;
  onSlug: (v: string) => void;
  onDescription: (v: string) => void;
}) {
  const uid = useId();
  // One grid = one shared label column: labels right-aligned beside their controls
  // (Display Name / Slug / Identifier / Geographic Region); Description spans both
  // columns with its box below, per the spec'd layout.
  return (
    <Card>
      <CardContent className="grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-5">
        <Label htmlFor={`${uid}-name`} className="justify-self-end">
          Display Name:
        </Label>
        <Input
          id={`${uid}-name`}
          placeholder={`My ${noun[0]?.toUpperCase()}${noun.slice(1)}`}
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
        <Label htmlFor={`${uid}-slug`} className="justify-self-end">
          Slug:
        </Label>
        <Input
          id={`${uid}-slug`}
          placeholder={`my-${noun}`}
          value={slug}
          onChange={(e) => onSlug(e.target.value.toLowerCase())}
        />
        <Label className="justify-self-end self-start pt-0.5">Identifier:</Label>
        <div className="flex flex-col gap-1">
          <code className="text-sm text-apt-text">
            <span className="text-apt-text-muted">{prefix}</span>
            {slug || <span className="italic text-apt-text-dim">slug</span>}
          </code>
          {/* Height reserved even while idle so the rows below don't shift the
              moment the user types and a verdict appears. */}
          <div className="min-h-4">
            <RdidStatusLine status={status} />
          </div>
        </div>
        <div className="col-span-2 flex flex-col gap-2">
          <Label htmlFor={`${uid}-description`}>Description:</Label>
          <Textarea
            id={`${uid}-description`}
            rows={3}
            placeholder={`What this ${noun} is for.`}
            value={description}
            onChange={(e) => onDescription(e.target.value)}
          />
        </div>
        <Label htmlFor={`${uid}-region`} className="justify-self-end">
          Geographic Region:
        </Label>
        <Input id={`${uid}-region`} placeholder="coming soon" value={region} disabled readOnly />

        <div className="col-span-2">
          <ErrorText error={error} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The "New Product" (workspace-scoped ecosystem create) form: Display Name + Slug are
 * typed; the Identifier derives live as `<parent rdid>.<slug>` and is probed for
 * availability. The probe verdict is written back INTO the dialog-owned draft so
 * the dialog's sync `saveEnabled` gate (ecoCreateReady) sees exactly what is shown.
 *
 * The prefix is the PARENT's rdid rather than anything assembled from the workspace slug,
 * because a workspace's home ecosystem is not always a root: a personal workspace's is itself
 * a child (`ecosystem.<realm>.<user>`), so `ecosystem.<workspace-slug>.` named an address that
 * does not exist. Taking the parent's own address as the prefix makes this preview agree with
 * the server's derivation by construction, whatever the chain above it turns out to be.
 */
export function EcosystemCreateForm({
  draft,
  onChange,
  error,
  parentRdid,
  noun = "ecosystem",
}: {
  draft: EcosystemCreateDraft;
  onChange: (next: EcosystemCreateDraft) => void;
  error?: string | null;
  /** The parent ecosystem's own rdid — see {@link EcosystemParentRdid}. */
  parentRdid: EcosystemParentRdid;
  /** Lowercase entity noun for placeholder copy (the hub passes "product"). */
  noun?: string;
}) {
  const slug = draft.slug.trim();
  const prefix = ecoCreatePrefix(parentRdid);
  // An unresolved parent is NOT probeable: the identifier it would probe is not the one the
  // create would mint, so an "Available!" there is a verdict about the wrong address. Hold at
  // "checking" instead — which also keeps Save disabled, since ecoCreateReady demands
  // "available".
  const resolving = parentRdid === undefined;
  const grammarOk = !resolving && slug !== "" && ecoCreateSlugValid(slug);

  const probe = useRdidAvailability(grammarOk ? prefix + slug : null);
  const status: RdidAvailability =
    slug === "" ? "idle" : resolving ? "checking" : !grammarOk ? "invalid" : probe;

  // The dialog owns the draft — write the probe verdict back into it so the sync
  // saveEnabled gate (ecoCreateReady) sees exactly the state this form displays.
  useEffect(() => {
    if (draft.rdidStatus !== status) onChange({ ...draft, rdidStatus: status });
  }, [status, draft, onChange]);

  return (
    <EcosystemFields
      prefix={prefix}
      name={draft.name}
      slug={draft.slug}
      description={draft.description}
      status={status}
      error={error}
      noun={noun}
      onName={(v) => onChange({ ...draft, name: v })}
      onSlug={(v) => onChange({ ...draft, slug: v })}
      onDescription={(v) => onChange({ ...draft, description: v })}
    />
  );
}

function RdidStatusLine({ status }: { status: RdidAvailability }) {
  if (status === "idle") return null;
  const line = (icon: React.ReactNode, text: string, className: string) => (
    <span className={`flex items-center gap-1.5 font-mono text-[0.7rem] ${className}`}>
      {icon}
      {text}
    </span>
  );
  switch (status) {
    case "checking":
      return line(
        <Loader2 size={14} className="animate-spin" aria-hidden />,
        "Checking availability…",
        "text-apt-text-dim",
      );
    case "available":
      return line(<CheckCircle2 size={14} aria-hidden />, "Available!", "text-apt-green");
    case "unavailable":
      return line(<TriangleAlert size={14} aria-hidden />, "Unavailable", "text-apt-orange");
    case "invalid":
      return line(<OctagonX size={14} aria-hidden />, "Invalid", "text-apt-red");
    case "error":
      return line(
        <TriangleAlert size={14} aria-hidden />,
        "Couldn't check availability — retry shortly.",
        "text-apt-text-dim",
      );
  }
}
