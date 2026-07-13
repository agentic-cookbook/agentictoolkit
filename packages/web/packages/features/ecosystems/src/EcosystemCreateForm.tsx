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
 * The live verdict on the derived identifier. Carried IN the create draft (not local
 * state) so the dialog's sync `saveEnabled` gate reads the same value this form
 * displays — the form owns the async probe and writes the verdict back via onChange.
 */
export type RdidAvailability =
  | "idle"
  | "checking"
  | "invalid"
  | "available"
  | "unavailable"
  | "error";

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
 * The "New Product" (workspace-scoped ecosystem create) form: Display Name + Slug are
 * typed; the Identifier is a read-only live derivation `ecosystem.<ownerScope>.<slug>`
 * with a debounced server availability probe (registry.identifiers is the system-wide
 * uniqueness authority — the same key the create 409s on). Unlike EcosystemDetail (the
 * edit / child-create form), the rdid is never directly editable here.
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
  const uid = useId();
  const slug = draft.slug.trim();
  const prefix = prefixFor("ecosystem", ownerScope.trim());
  const grammarOk = slug !== "" && ecoCreateRdidValid(ownerScope, slug);

  // Debounce the typed slug so the probe fires on pauses, not on every keystroke
  // (the same 350ms idiom as the hub's profile slug-availability check).
  const [debouncedSlug, setDebouncedSlug] = useState(slug);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(slug), 350);
    return () => clearTimeout(timer);
  }, [slug]);

  const probeRdid = prefix + debouncedSlug;
  const existsQuery = useQuery({
    queryKey: ["rdid-exists", probeRdid],
    queryFn: () => identifiersApi.exists(probeRdid),
    enabled: debouncedSlug !== "" && ecoCreateRdidValid(ownerScope, debouncedSlug),
    retry: false,
    staleTime: 30_000,
  });

  const status: RdidAvailability =
    slug === ""
      ? "idle"
      : !grammarOk
        ? "invalid"
        : slug !== debouncedSlug || existsQuery.isFetching
          ? "checking"
          : existsQuery.data === false
            ? "available"
            : existsQuery.data === true
              ? "unavailable"
              : existsQuery.isError
                ? "error"
                : "checking";

  // The dialog owns the draft — write the probe verdict back into it so the sync
  // saveEnabled gate (ecoCreateReady) sees exactly the state this form displays.
  useEffect(() => {
    if (draft.rdidStatus !== status) onChange({ ...draft, rdidStatus: status });
  }, [status, draft, onChange]);

  function set<K extends keyof EcosystemCreateDraft>(key: K, value: string) {
    onChange({ ...draft, [key]: value });
  }

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
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <Label htmlFor={`${uid}-slug`} className="justify-self-end">
          Slug:
        </Label>
        <Input
          id={`${uid}-slug`}
          placeholder={`my-${noun}`}
          value={draft.slug}
          onChange={(e) => set("slug", e.target.value.toLowerCase())}
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
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <Label htmlFor={`${uid}-region`} className="justify-self-end">
          Geographic Region:
        </Label>
        <Input id={`${uid}-region`} placeholder="coming soon" value="" disabled readOnly />

        <div className="col-span-2">
          <ErrorText error={error} />
        </div>
      </CardContent>
    </Card>
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
