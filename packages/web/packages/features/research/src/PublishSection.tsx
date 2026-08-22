"use client";

import { useId } from "react";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";

import { useAction } from "@agentic-toolkit/crud";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Button, buttonVariants } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { FieldGroup } from "@agentic-toolkit/ui/blocks/field-group";
import { useClipboard } from "@agentic-toolkit/ui/hooks/useClipboard";
import type { ResearchDocument } from "@agentic-toolkit/data/markdown";
import { markdownApi } from "@agentic-toolkit/data/markdown";
import type { SlugVerdict } from "@agentic-toolkit/ui/blocks/document-identity-field";
import { toneTextClass } from "@agentic-toolkit/ui/lib/tone";
import { PUBLIC_ROUTE_RE } from "./research-model";

// Deliberately hard-coded, not per-environment, and not a defect: `features/research` is a
// MECHANISM-tier package (see `scripts/check_boundaries.py` at the submodule root, which both
// defines and enforces the mechanism/vocabulary tier rule), and the per-environment origin
// that would replace this literal — `adh-registry`'s `research` site entry, resolved through
// its `siteUrl`/`localOrigin` seam — lives in `@agentic-toolkit/adh-registry`, a
// VOCABULARY-tier package that encodes the whole site registry. A MECHANISM package must not
// import a VOCABULARY one (this file would otherwise be reaching past its own layer for one
// string), and the host that COULD inject it — this feature's mount point — is
// `frontend/src/sites/research/` in the adh superproject, outside this repo entirely: this
// package has no seam a superproject site can push a resolved origin through (contrast
// `ProfilePanel.profileUrlFor`, which exists for exactly that purpose and is the pattern a
// real fix here would need). So the Preview link this constant backs ALWAYS points at
// production, even from `*.dev.local` or a preview deployment — a locally-drafted, unpublished
// paper's Preview may 404 there. That is a known, accepted limitation of previewing locally,
// not a bug in this component: fixing it requires either a host-injected origin prop threaded
// in from the superproject site (a change outside this repo) or importing `adh-registry` here
// (a layering violation this repo forbids).
const RESEARCH_ORIGIN = "https://agenticdeveloperresearch.com";
const SLUG_PLACEHOLDER = "your-slug";

/** The public URL a published paper resolves at. The author's slug comes from
 *  their profile; when it isn't set yet we show a placeholder + a hint. Always a PRODUCTION
 *  URL — see `RESEARCH_ORIGIN` above. */
function publicUrl(slug: string, route: string): string {
  return `${RESEARCH_ORIGIN}/${slug || SLUG_PLACEHOLDER}/${route}`;
}

/**
 * The publish concern for the selected (saved) document — distinct from the
 * draft fields. A draft shows where publishing will put it and a Publish button;
 * a published paper shows its public URL with copy + preview controls and an Unpublish
 * button. Mutations run through the document API and lift the updated document
 * back to the pane so the list + selection stay in sync.
 *
 * The route is a PROP, not state here. It is the same slug the identity field above the body
 * edits, and two inputs for one value was the defect this replaced: an author could type one
 * slug into the editor and a different one into this card, and only one of them meant
 * anything.
 */
export function PublishSection({
  doc,
  route,
  verdict,
  userSlug,
  workspaceSlug,
  onChanged,
  disabled = false,
}: {
  doc: ResearchDocument;
  /** Where publishing will put this paper — owned by the pane, edited above the body. */
  route: string;
  /** The identity field's live availability verdict for `route`, from the same
   *  `useSlugAvailability` call the pane wires to `DocumentIdentityField` above the body — one
   *  verdict, read by both controls. Omit only for a host with no availability check at all;
   *  when present, Publish is gated on it exactly as Save is: a slug the UI is showing as
   *  "Unavailable" must not be offered for publish, even though the format regex alone would
   *  accept it (the backend would 409 such a publish, but the UI must not invite the round trip). */
  verdict?: SlugVerdict;
  userSlug: string;
  /** Pins publish/unpublish to the WORKSPACE'S owning principal (backend `?workspace=`),
   *  so org-owned docs other members created resolve. */
  workspaceSlug?: string;
  onChanged: (updated: ResearchDocument) => void | Promise<void>;
  /** `doc` is a CACHED copy the server has not yet confirmed. Publishing is a write like any
   *  other, so it waits: the visibility on screen may already be stale, and acting on it could
   *  unpublish a paper the user is looking at as published. Copy stays enabled — reading a URL
   *  changes nothing. */
  disabled?: boolean;
}) {
  const { busy, error, run } = useAction();
  const { copied, copy } = useClipboard();
  // The Publish button below uses the native `disabled` attribute (via `Button` →
  // `PressableButton` → base-ui's `Button.Props`, no `focusableWhenDisabled` exists anywhere
  // in `ui/src` — grepped) — a natively disabled element is removed from the tab order, so it
  // is never focused and its `aria-describedby` is never read. That means the reason text
  // below must be announced some other way: an `aria-live` region, following the exact
  // arrangement `document-identity-field.tsx`'s `slugStatusId`/`slug-status` span uses —
  // unconditionally mounted, with only its TEXT conditional, so the region already exists in
  // the DOM before the first verdict lands and that first change is observed. The
  // `aria-describedby` link is kept anyway: it costs nothing and is correct markup for any
  // future host that renders Publish as a focusable (e.g. `aria-disabled`) control instead.
  const publishDisabledReasonId = useId();

  const trimmed = route.trim().toLowerCase();
  const routeValid = PUBLIC_ROUTE_RE.test(trimmed);
  // Undefined verdict (no host-supplied availability check) reads as "not unavailable" — this
  // gate must never be the reason Publish is disabled for a host that never wired one in.
  const routeUnavailable = verdict?.status === "unavailable";

  function publish(): void {
    void run(async () => {
      const updated = await markdownApi.publish(doc.id, trimmed, { workspace: workspaceSlug });
      await onChanged(updated);
    });
  }

  function unpublish(): void {
    void run(async () => {
      const updated = await markdownApi.unpublish(doc.id, { workspace: workspaceSlug });
      await onChanged(updated);
    });
  }

  if (doc.visibility === "public" && doc.publicRoute) {
    const url = publicUrl(userSlug, doc.publicRoute);
    return (
      <FieldGroup
        title="Publishing"
        trailing={
          <Badge variant="success">
            <Globe data-icon="inline-start" className="size-3" />
            Published
          </Badge>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="research-public-url" className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
            Public URL
          </Label>
          <div className="flex items-center gap-2">
            <Input id="research-public-url" readOnly value={url} className="font-mono text-[0.8rem]" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!userSlug}
              onClick={() => void copy(url)}
            >
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            {userSlug && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLink data-icon="inline-start" />
                Preview
              </a>
            )}
          </div>
          {!userSlug && (
            <p className="text-xs text-apt-text-dim">
              Set a profile slug to claim your public URL.
            </p>
          )}
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" disabled={busy || disabled} onClick={unpublish}>
            {busy ? "Unpublishing…" : "Unpublish"}
          </Button>
        </div>
      </FieldGroup>
    );
  }

  return (
    <FieldGroup title="Publishing">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-apt-text-dim">
          {trimmed ? (
            routeValid ? (
              <>
                This paper is a private draft. Publishing puts it at{" "}
                <span className="font-mono text-apt-text">{publicUrl(userSlug, trimmed)}</span>.
              </>
            ) : (
              "That slug can’t be a public route — edit it above the body."
            )
          ) : (
            "Give this paper a title or slug above to publish it."
          )}
        </p>
        <div className="flex flex-col items-end gap-1">
          {/* Unconditionally mounted (only its TEXT is conditional) — same reason as
              `document-identity-field.tsx`'s `slug-status` span: an `aria-live` region has to
              already exist in the DOM before its content changes for assistive tech to have
              anything to have observed the mutation on. This is also the ONLY thing that
              announces the reason at all, since the Publish button below is natively disabled
              (see the comment on `publishDisabledReasonId` above) and so never receives the
              focus that would let its `aria-describedby` be read. */}
          <p
            data-slot="publish-disabled-reason"
            id={publishDisabledReasonId}
            aria-live="polite"
            className={`text-xs ${toneTextClass("error")}`}
          >
            {routeUnavailable ? `Can’t publish: ${verdict?.reason ?? "this slug is unavailable."}` : null}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={!routeValid || routeUnavailable || busy || disabled}
            aria-describedby={routeUnavailable ? publishDisabledReasonId : undefined}
            onClick={publish}
          >
            {busy ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>
      <ErrorText error={error} />
    </FieldGroup>
  );
}
