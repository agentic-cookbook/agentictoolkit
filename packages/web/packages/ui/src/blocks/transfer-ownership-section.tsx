"use client";

import * as React from "react";
import { ArrowRightLeft, TriangleAlert } from "lucide-react";
import { Button } from "../components/button";
import { Disclosure } from "../components/disclosure";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "../components/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../components/dialog";
import { cn } from "../lib/utils";

/**
 * Which NAMESPACE a workspace slug is drawn from.
 *
 * Load-bearing, not decoration: a personal workspace's slug and an organization's slug are unique
 * only within their own table, so one string can name two different workspaces. Without the kind a
 * menu of `["acme" (mine), "acme" (the org I'm in)]` is two entries the caller cannot tell apart —
 * React sees duplicate keys, and the server, handed the slug alone, resolves whichever namespace it
 * checks first.
 */
export type TransferTargetKind = "customer" | "organization";

/** A destination. `children` turns the entry into a submenu (workspace → its Products). */
export interface TransferTarget {
  slug: string;
  /**
   * Omitted only for a target that is NOT a workspace — a nested Product, whose `slug` is an
   * ecosystem rdid and therefore already globally unique. Every workspace-level target should
   * carry one.
   */
  kind?: TransferTargetKind;
  name: string;
  children?: TransferTarget[];
}

/** Enough of a {@link TransferTarget} to point at one. */
export type TransferTargetRef = Pick<TransferTarget, "slug" | "kind">;

/**
 * The identity of a menu entry: `kind` and `slug` TOGETHER, never the slug alone. Used for the
 * React key and for the "(current)" match, so both answer the same question the same way.
 */
function targetKey(target: TransferTargetRef): string {
  return `${target.kind ?? ""}:${target.slug}`;
}

/**
 * Is this entry the destination the object already lives in?
 *
 * A missing kind on either side falls back to the slug alone — the pre-`kind` behaviour, kept for
 * targets that legitimately have none (a nested Product) and for a caller that cannot determine
 * its own. It only ever affects which entry is greyed out and labelled "(current)"; being wrong
 * here disables the wrong menu item, it never sends a transfer anywhere.
 */
function isCurrentTarget(target: TransferTarget, current?: TransferTargetRef): boolean {
  if (!current || target.slug !== current.slug) return false;
  if (target.kind === undefined || current.kind === undefined) return true;
  return target.kind === current.kind;
}

/** What the server says the transfer will do. Never reconstructed on the client. */
export interface TransferPreviewResult {
  newId: string | null;
  tokens: number;
  // `via` mirrors the server's `RevokedSubject['via']` (@agentic-toolkit/data ownership) — a
  // participant seat is its own provenance, not a flavour of "direct", and neither is a bucket
  // access-group seat ("group"). `kind` likewise spans both layers: "organization", "app" and
  // "token" reach this list only through a bucket access group, whose member list admits them.
  // Both are rendered as bare strings below, so a new member needs no rendering change, only the
  // union — but dropping one would silently narrow what the dialog can be handed.
  revoking: {
    kind: "user" | "team" | "persona" | "organization" | "app" | "token";
    id: string;
    name: string;
    via: "role" | "team" | "direct" | "participant" | "group";
  }[];
}

export interface TransferOwnershipSectionProps {
  /** Singular entity noun, e.g. "Persona" — used in the button and copy. */
  entityNoun: string;
  /** The object's own identifier, shown in the dialog. */
  entityLabel: string;
  /** Candidate destinations. Team workspaces must already be filtered out by the caller. */
  targets: TransferTarget[];
  /** The destination the object already lives in — shown disabled, so the menu reads as a location. */
  currentTarget?: TransferTargetRef;
  /** Server preflight. Its result populates the dialog; a throw shows an inline error. */
  onPreview: (target: TransferTarget) => Promise<TransferPreviewResult>;
  /** Performs the transfer. A throw shows an inline error and keeps the dialog open. */
  onConfirm: (target: TransferTarget) => Promise<void>;
}

/**
 * Transfer an object to another workspace, from its own settings pane. A disclosure (collapsed,
 * neutral) reveals a dropdown of destinations; picking one runs a SERVER preflight and opens an
 * "Are you sure?" dialog that names the object's new address and every principal who loses access.
 *
 * The losses are named before the transfer runs, while it can still be cancelled, because the
 * transferring admin is admin of BOTH workspaces and is therefore the one party entitled to see
 * both sides. Access is not carried across: the target's own roles apply on arrival. Sibling of
 * {@link DeleteEntitySection}, whose confirm vocabulary this follows so every surface behaves the
 * same way.
 */
export function TransferOwnershipSection({
  entityNoun,
  entityLabel,
  targets,
  currentTarget,
  onPreview,
  onConfirm,
}: TransferOwnershipSectionProps): React.ReactElement {
  const [disclosed, setDisclosed] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [chosen, setChosen] = React.useState<TransferTarget | null>(null);
  const [preview, setPreview] = React.useState<TransferPreviewResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const noun = entityNoun.toLowerCase();

  /**
   * The dialog is sealed only while the TRANSFER is running — never while the preflight is.
   * `onPreview` mutates nothing (the server runs the real transfer and rolls it back), so a slow
   * or hung preflight has no correctness claim on the user's ability to back out; sealing it too
   * would trap them behind "Checking…" with no exit. `confirm()` is the only path that sets `busy`
   * with a preview already in hand, which is what makes this derived rather than a fourth flag.
   */
  const confirming = busy && preview !== null;

  /**
   * Identifies the in-flight preflight. Because the preview IS cancellable, its promise can now
   * resolve after the user cancelled or picked a different workspace — and a late resolution
   * landing on the wrong target would show them the wrong losses for the transfer they are about
   * to authorize. Every settled preflight checks it still owns this ref before touching state.
   */
  const previewSeq = React.useRef(0);

  function reset(): void {
    previewSeq.current += 1; // orphan any preflight still in flight
    setChosen(null);
    setPreview(null);
    setBusy(false);
    setError(null);
  }

  async function choose(target: TransferTarget): Promise<void> {
    const seq = (previewSeq.current += 1);
    setMenuOpen(false);
    setChosen(target);
    setPreview(null);
    setError(null);
    setBusy(true);
    try {
      const result = await onPreview(target);
      if (seq !== previewSeq.current) return;
      setPreview(result);
    } catch (e) {
      if (seq !== previewSeq.current) return;
      setError(e instanceof Error ? e.message : `Could not check this transfer.`);
    } finally {
      if (seq === previewSeq.current) setBusy(false);
    }
  }

  async function confirm(): Promise<void> {
    if (!chosen || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(chosen);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to transfer ${noun}.`);
      setBusy(false);
    }
  }

  function renderTarget(target: TransferTarget): React.ReactElement {
    if (target.children && target.children.length > 0) {
      return (
        <DropdownMenuSub key={targetKey(target)}>
          <DropdownMenuSubTrigger>{target.name}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {target.children.map((child) => renderTarget(child))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }
    const isCurrent = isCurrentTarget(target, currentTarget);
    return (
      <DropdownMenuItem
        key={targetKey(target)}
        disabled={isCurrent}
        onClick={isCurrent ? undefined : () => void choose(target)}
      >
        {isCurrent ? `${target.name} (current)` : target.name}
      </DropdownMenuItem>
    );
  }

  return (
    <section aria-label="Transfer Ownership">
      <Disclosure
        open={disclosed}
        onOpenChange={setDisclosed}
        title={
          <span className="inline-flex items-center gap-1.5">
            <ArrowRightLeft className="size-4 shrink-0 text-apt-text-muted" aria-hidden />
            Transfer Ownership
          </span>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-apt-text-muted">
            Move this {noun} to another workspace. Its address changes, and everything beneath it
            is re-addressed with it. Access granted in this workspace does not follow.
          </p>
          <div>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              {/* Named for the ACTION, not the section — the Disclosure header above is already a
                  button named "Transfer Ownership", and two buttons sharing one accessible name
                  make the section ambiguous to a screen reader and to every role query. Same split
                  as DeleteEntitySection: "Danger Zone" / "Delete {entityNoun}". */}
              <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                <ArrowRightLeft data-icon="inline-start" />
                Transfer {entityNoun}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {targets.map((t) => renderTarget(t))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Disclosure>

      <Dialog open={chosen !== null} onOpenChange={(next) => { if (!next && !confirming) reset(); }}>
        <DialogContent showClose={!confirming}>
          <DialogHeader>
            <DialogTitle>
              Transfer this {entityNoun} to {chosen?.name}?
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono text-apt-text">{entityLabel}</span> will move to{" "}
              {chosen?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 text-sm">
            {busy && !preview && <p className="text-apt-text-muted">Checking…</p>}
            {preview && (
              <>
                {preview.newId && (
                  <p className="text-apt-text-muted">
                    Its new address will be{" "}
                    <span className="font-mono text-apt-text">{preview.newId}</span>.
                  </p>
                )}
                {preview.tokens > 0 && (
                  <p className="inline-flex items-start gap-1.5 text-apt-text-muted">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-apt-gold" aria-hidden />
                    {preview.tokens} API {preview.tokens === 1 ? "token" : "tokens"} bound to this{" "}
                    {noun} will be revoked.
                  </p>
                )}
                {preview.revoking.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-apt-text-muted">These will lose access:</span>
                    <ul className="list-disc pl-5">
                      {preview.revoking.map((s) => (
                        <li key={`${s.kind}:${s.id}`} className="text-apt-text">
                          {s.name}{" "}
                          <span className="text-apt-text-muted">
                            ({s.kind === "user" ? s.via : `${s.kind}, ${s.via}`})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-apt-text-muted">No access is revoked.</p>
                )}
              </>
            )}
            {error && <p className={cn("text-sm", "text-apt-red")}>{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={reset} disabled={confirming}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirm} disabled={busy || !preview}>
              {confirming ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
