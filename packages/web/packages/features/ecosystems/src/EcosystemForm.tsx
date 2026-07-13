"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { SEGMENT_RE, prefixFor, validateLeaf } from "@agentic-toolkit/ui/lib/rdid";
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
 *  DERIVED (`ecosystem.<ownerScope>.<slug>`), never typed. */
export interface EcosystemCreateDraft {
  name: string;
  slug: string;
  description: string;
  rdidStatus: RdidAvailability;
}

export function ecoCreateBlank(): EcosystemCreateDraft {
  return { name: "", slug: "", description: "", rdidStatus: "idle" };
}

/** The full owner-scoped rdid the create will mint: `ecosystem.<ownerScope>.<slug>`
 *  (`ecosystem.<slug>` when the host mounts without a workspace scope). */
export function ecoCreateRdid(ownerScope: string, slug: string): string {
  return prefixFor("ecosystem", ownerScope) + slug;
}

/** Whether every segment of the assembled rdid (owner scope + leaf) is well-formed —
 *  the same grammar bar the backend's assertRdid applies to the whole identifier. */
export function ecoCreateRdidValid(ownerScope: string, slug: string): boolean {
  const scope = ownerScope.trim();
  const scopeOk = scope === "" || scope.split(".").every((seg) => SEGMENT_RE.test(seg));
  return scopeOk && validateLeaf(slug) === null;
}

/** Save-button gate: Name and Slug filled in AND the derived rdid probed available. */
export function ecoCreateReady(d: EcosystemCreateDraft): boolean {
  return d.name.trim() !== "" && d.slug.trim() !== "" && d.rdidStatus === "available";
}

/** Click-time backstop mirroring {@link ecoCreateReady} with actionable messages —
 *  Save stays disabled until ready, so these only surface if that gate is bypassed. */
export function ecoCreateValidate(
  d: EcosystemCreateDraft,
  ownerScope: string,
): string | null {
  if (!d.name.trim()) return "Display name is required.";
  const slug = d.slug.trim();
  if (!slug) return "Slug is required.";
  if (!ecoCreateRdidValid(ownerScope, slug))
    return `"${ecoCreateRdid(ownerScope, slug)}" is not a valid identifier — lowercase letters, digits, and interior hyphens only.`;
  if (d.rdidStatus === "unavailable")
    return `Identifier "${ecoCreateRdid(ownerScope, slug)}" is already in use.`;
  if (d.rdidStatus !== "available") return "Waiting for the identifier availability check.";
  return null;
}

/** Map the draft to the API input. The identifier is the derived owner-scoped rdid;
 *  region/domain are not collected by this form (region is coming soon, domain dropped). */
export function ecoCreateToInput(
  d: EcosystemCreateDraft,
  ownerScope: string,
): EcosystemInput {
  return {
    identifier: ecoCreateRdid(ownerScope, d.slug.trim()),
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
 * typed; the Identifier derives live as `ecosystem.<ownerScope>.<slug>` and is probed
 * for availability. The probe verdict is written back INTO the dialog-owned draft so
 * the dialog's sync `saveEnabled` gate (ecoCreateReady) sees exactly what is shown.
 */
export function EcosystemCreateForm({
  draft,
  onChange,
  error,
  ownerScope,
  noun = "ecosystem",
}: {
  draft: EcosystemCreateDraft;
  onChange: (next: EcosystemCreateDraft) => void;
  error?: string | null;
  /** The workspace owner's slug — the fixed rdid scope. "" renders `ecosystem.<slug>`. */
  ownerScope: string;
  /** Lowercase entity noun for placeholder copy (the hub passes "product"). */
  noun?: string;
}) {
  const slug = draft.slug.trim();
  const prefix = prefixFor("ecosystem", ownerScope.trim());
  const grammarOk = slug !== "" && ecoCreateRdidValid(ownerScope, slug);

  const probe = useRdidAvailability(grammarOk ? prefix + slug : null);
  const status: RdidAvailability = slug === "" ? "idle" : !grammarOk ? "invalid" : probe;

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
