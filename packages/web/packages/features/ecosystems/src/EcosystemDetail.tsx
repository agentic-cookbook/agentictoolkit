"use client";

import { useEffect, useId, useRef } from "react";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { RdidEditor } from "@agentic-toolkit/adh-ui/components/rdid-editor";
import { validateLeaf } from "@agentic-toolkit/adh-ui/rdid";
import { DetailSection } from "@agentic-toolkit/resource";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import type { Ecosystem, EcosystemInput } from "@agentic-toolkit/data/ecosystems";

export function ecoBlank(): EcosystemInput {
  return { identifier: "", name: "", description: "", region: "", domain: "" };
}

export function ecoToInput(e: Ecosystem): EcosystemInput {
  return {
    identifier: e.identifier,
    name: e.name,
    description: e.description,
    region: e.region,
    domain: e.domain,
  };
}

export function ecoDiffers(a: EcosystemInput, b: EcosystemInput): boolean {
  return (Object.keys(a) as (keyof EcosystemInput)[]).some(
    (k) => a[k].trim() !== b[k].trim(),
  );
}

export function ecoNormalize(d: EcosystemInput): EcosystemInput {
  return {
    identifier: d.identifier.trim(),
    name: d.name.trim(),
    description: d.description.trim(),
    region: d.region.trim(),
    domain: d.domain.trim(),
  };
}

/**
 * Returns an error message, or null when the draft is valid.
 *
 * `prefix` is the address the create will hang the typed leaf off — the PARENT's own rdid plus a
 * dot, since the server derives `<parent path>.<slug>` by walking the new row's parent chain. It
 * is a parameter, with no default, rather than the hardcoded `ecosystem.` this form assumed for
 * its whole life, because the taken-check depends on it: comparing a root-shaped `ecosystem.<leaf>`
 * against a sibling list of real (owner-scoped) rdids both MISSES every genuine collision and,
 * worse, FALSELY blocks a legal child create whenever the caller happens to own an unrelated ROOT
 * of the same leaf — and every product minted before address derivation moved to the parent chain
 * is exactly such a root.
 *
 * `""` means the parent is still resolving, which is not a valid draft: the address is unknown, so
 * neither the grammar nor the taken-check has anything to answer about.
 */
export function ecoValidate(
  draft: EcosystemInput,
  takenIdentifiers: string[],
  prefix: string,
): string | null {
  if (!prefix) return "Still working out where this will live — one moment.";
  const id = draft.identifier.trim();
  if (!id) return "Identifier is required.";
  if (!id.startsWith(prefix) || validateLeaf(id.slice(prefix.length)) !== null)
    return `Identifier must be ${prefix}<name>, e.g. ${prefix}my-ecosystem`;
  if (takenIdentifiers.includes(id)) return `Identifier "${id}" is already in use.`;
  if (!draft.name.trim()) return "Name is required.";
  return null;
}

/**
 * Re-hang a draft identifier off a different parent: strip `fromPrefix`, reattach `toPrefix`.
 *
 * The draft holds a finished ADDRESS, never a bare leaf, so anything that moves the parent — the
 * create dialog's top-level toggle, or the home ecosystem's lookup simply landing after the user
 * started typing — has to move what is already typed along with it. An identifier that does not
 * start with `fromPrefix` is treated as all leaf, which is exactly the shape typed while the prefix
 * was still `""` (parent unresolved).
 */
export function rehangIdentifier(
  identifier: string,
  fromPrefix: string,
  toPrefix: string,
): string {
  const leaf =
    fromPrefix && identifier.startsWith(fromPrefix)
      ? identifier.slice(fromPrefix.length)
      : identifier;
  return toPrefix + leaf;
}

/**
 * Controlled ecosystem form — fields only. Save/Cancel/Delete live in the
 * MasterDetailLayout button bar; the pane owns the draft + dirty/validity state.
 */
export function EcosystemDetail({
  title,
  draft,
  onChange,
  error,
  identifierLocked = false,
  identifierPrefix,
}: {
  /** When omitted, the form renders without the section heading (e.g. the
   * single-ecosystem Settings editor, which has no "ECOSYSTEM" header). */
  title?: string;
  draft: EcosystemInput;
  onChange: (next: EcosystemInput) => void;
  error?: string | null;
  /** Lock the identifier when editing a saved ecosystem — it's the immutable
   * rdid and update() ignores it, so an editable field would mislead. */
  identifierLocked?: boolean;
  /** The static address the typed leaf hangs off — the parent's own rdid plus a dot. Required and
   * defaultless: pass what the server will actually derive, which is the same value given to
   * {@link ecoValidate}, so the preview and the taken-check can never answer about different
   * addresses. `""` (parent unresolved) renders a bare field the validator refuses. */
  identifierPrefix: string;
}) {
  // Unique per instance: the create dialog mounts a second EcosystemDetail over
  // the Settings pane's, so fixed ids would collide and break the <label for> links.
  const uid = useId();

  // The prefix can MOVE after the user has typed: the home-ecosystem lookup lands, or the create
  // dialog's toggle picks a different parent. The draft holds a finished address, so left alone the
  // identifier stays hung off the OLD parent — while the field below still displays it as though it
  // were the leaf (the `startsWith` fallback), so the row reads exactly right and {@link ecoValidate}
  // refuses it anyway with "Identifier must be <prefix><name>", an error naming what is already on
  // screen. Re-hang it instead. Skipped when the identifier already starts with the current prefix,
  // so a caller that re-hung synchronously (the toggle, which has no frame of stale display) is not
  // applied a second time on top of its own result.
  const hungOff = useRef(identifierPrefix);
  useEffect(() => {
    const from = hungOff.current;
    hungOff.current = identifierPrefix;
    // An empty identifier is nothing typed yet: prepending the prefix would fill the field with a
    // bare parent address and turn "Identifier is required." into a grammar complaint.
    if (identifierLocked || !draft.identifier || draft.identifier.startsWith(identifierPrefix))
      return;
    onChange({ ...draft, identifier: rehangIdentifier(draft.identifier, from, identifierPrefix) });
  }, [identifierPrefix, identifierLocked, draft, onChange]);

  function set<K extends keyof EcosystemInput>(key: K, value: string) {
    onChange({ ...draft, [key]: value });
  }

  const card = (
      <Card>
        <CardContent className="flex flex-col gap-5">
          {/* On CREATE this field is the slug, not the finished address: the server derives the
              address from the new ecosystem's parent chain, so only the last segment — what is
              typed here — comes from the client. `identifierPrefix` carries the rest, so the
              preview is the address that will actually be minted rather than a root-shaped guess.
              Editing a SAVED row is the other case: there the identifier IS the full rdid, the
              prefix is its own scope, and the field is locked. */}
          <RdidEditor
            id={`${uid}-identifier`}
            label="Identifier"
            prefix={identifierPrefix}
            value={
              identifierPrefix && draft.identifier.startsWith(identifierPrefix)
                ? draft.identifier.slice(identifierPrefix.length)
                : draft.identifier
            }
            placeholder="my-ecosystem"
            hint={
              identifierLocked
                ? "Fixed once created."
                : "The name is the last segment of the identifier — the rest is the parent's own address."
            }
            disabled={identifierLocked}
            onChange={(leaf) => set("identifier", identifierPrefix + leaf)}
          />
          <Field
            id={`${uid}-name`}
            label="Name"
            hint="Display name."
            placeholder="My Ecosystem"
            value={draft.name}
            onChange={(v) => set("name", v)}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${uid}-description`}>Description</Label>
            <Textarea
              id={`${uid}-description`}
              rows={3}
              placeholder="What this ecosystem is for."
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <Field
            id={`${uid}-region`}
            label="Geographical region"
            hint="Optional — defaults to none."
            placeholder="none"
            value={draft.region}
            onChange={(v) => set("region", v)}
          />
          <Field
            id={`${uid}-domain`}
            label="Domain"
            placeholder="myecosystem.com"
            value={draft.domain}
            onChange={(v) => set("domain", v)}
          />

          <ErrorText error={error} />
        </CardContent>
      </Card>
  );

  return title ? <DetailSection title={title}>{card}</DetailSection> : card;
}

function Field({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-apt-text-muted">{hint}</p>}
    </div>
  );
}
