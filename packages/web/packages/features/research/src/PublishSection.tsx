"use client";

import { useState } from "react";
import { Check, Copy, Globe } from "lucide-react";

import { useAction } from "@agentic-toolkit/crud";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { FieldGroup } from "@agentic-toolkit/ui/blocks/field-group";
import { useClipboard } from "@agentic-toolkit/ui/hooks/useClipboard";
import type { ResearchDocument } from "@agentic-toolkit/data/markdown";
import { markdownApi } from "@agentic-toolkit/data/markdown";
import { PUBLIC_ROUTE_RE } from "./research-model";

const RESEARCH_ORIGIN = "https://agenticdeveloperresearch.com";
const SLUG_PLACEHOLDER = "your-slug";

/** The public URL a published paper resolves at. The author's slug comes from
 *  their profile; when it isn't set yet we show a placeholder + a hint. */
function publicUrl(slug: string, route: string): string {
  return `${RESEARCH_ORIGIN}/${slug || SLUG_PLACEHOLDER}/${route}`;
}

/**
 * The publish concern for the selected (saved) document — distinct from the
 * draft fields. A draft shows a route input + live preview and a Publish button;
 * a published paper shows its public URL with a copy button and an Unpublish
 * button. Mutations run through the document API and lift the updated document
 * back to the pane so the list + selection stay in sync. Remount per document
 * (key={doc.id}) so the route input resets without an effect.
 */
export function PublishSection({
  doc,
  userSlug,
  workspaceSlug,
  onChanged,
  disabled = false,
}: {
  doc: ResearchDocument;
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
  const [route, setRoute] = useState(doc.publicRoute ?? "");
  const { busy, error, run } = useAction();
  const { copied, copy } = useClipboard();

  const trimmed = route.trim().toLowerCase();
  const routeValid = PUBLIC_ROUTE_RE.test(trimmed);

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
        <Label htmlFor="research-route" className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
          Public route
        </Label>
        <div className="flex items-end gap-2">
          <Input
            id="research-route"
            value={route}
            placeholder="my-paper"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={route !== "" && !routeValid}
            onChange={(e) => setRoute(e.target.value.toLowerCase())}
            disabled={disabled}
            className="font-mono text-[0.8rem]"
          />
          <Button type="button" size="sm" disabled={!routeValid || busy || disabled} onClick={publish}>
            {busy ? "Publishing…" : "Publish"}
          </Button>
        </div>
        {route !== "" && !routeValid ? (
          <p className="text-xs text-apt-red">
            Lowercase letters, digits, “-” and “_”; 2–128 chars, starting with a letter or digit.
          </p>
        ) : (
          <p className="text-xs text-apt-text-dim">
            {trimmed ? publicUrl(userSlug, trimmed) : "Choose a route to publish this paper publicly."}
          </p>
        )}
      </div>
      <ErrorText error={error} />
    </FieldGroup>
  );
}
