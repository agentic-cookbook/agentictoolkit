"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@agentic-toolkit/ui/components/dialog";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import { DialogErrorText } from "@agentic-toolkit/ui/components/error-text";
import { UnsavedChangesAlert } from "@agentic-toolkit/ui/components/unsaved-changes-alert";
import { PLATFORM_LABELS } from "@agentic-toolkit/ui/blocks";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import {
  createSocialLink,
  updateSocialLink,
  deleteSocialLink,
  resolvePrivacyLevel,
  socialLinksKey,
  type SocialLink,
  type PrivacyGrant,
} from "@agentic-toolkit/data/profile";
import { DetailSection, useReportSettingsDirty } from "@agentic-toolkit/resource";
import { PrivacyLevelControl } from "./PrivacyLevelControl";

// ── Types ──────────────────────────────────────────────────────────────────────

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; link: SocialLink };

type FormDraft = {
  platform: string;
  url: string;
  handle: string;
};

const PLATFORMS = Object.entries(PLATFORM_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const DEFAULT_PLATFORM = PLATFORMS[0]?.value ?? "instagram";

function emptyDraft(): FormDraft {
  return { platform: DEFAULT_PLATFORM, url: "", handle: "" };
}

/** The loaded row as a draft — the baseline an edit is diffed against. */
function draftOf(link: SocialLink): FormDraft {
  return { platform: link.platform, url: link.url, handle: link.handle };
}

/** Compared exactly as `handleSave` writes: the URL trimmed, the rest verbatim, so the
 *  gate and the write can never disagree about what "changed" means. (The trim is
 *  belt-and-braces rather than an observable rule — the URL box is an `input[type=url]`,
 *  whose value-sanitization algorithm already strips surrounding whitespace before the
 *  value is readable. It stays so the two stay in step if that field ever changes type.) */
function sameLink(a: FormDraft, b: FormDraft): boolean {
  return (
    a.platform === b.platform && a.url.trim() === b.url.trim() && a.handle === b.handle
  );
}

export const SOCIAL_LINK_URL_REQUIRED_MESSAGE = "URL is required.";

/**
 * WHY Save can't fire, or null when nothing is blocking. A reason rather than a boolean
 * because the gate DISABLES Save, which is exactly what makes `handleSave`'s own
 * `setFormError` unreachable — a greyed-out Save has to say what it is waiting on.
 */
export function socialLinkBlockedReason(draft: FormDraft): string | null {
  return draft.url.trim() === "" ? SOCIAL_LINK_URL_REQUIRED_MESSAGE : null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface SocialLinksSectionProps {
  links: SocialLink[];
  isLoading: boolean;
  grants: PrivacyGrant[];
  /** When true, suppresses the "Social links" DetailSection heading so the
   *  topic's FeatureTitle (rendered by SettingsTab) serves as the heading
   *  instead — avoids duplicate h2/h3 stacking when used as its own topic. */
  hideSectionTitle?: boolean;
  /** When set, all reads/writes target this workspace (org) owner via ?workspace=; the
   *  react-query cache key is namespaced by it so org and personal caches never collide. */
  workspaceSlug?: string;
  /** When true, hides the per-item privacy tier control (orgs have no public card). */
  hidePrivacy?: boolean;
}

export function SocialLinksSection({
  links,
  isLoading,
  grants,
  hideSectionTitle = false,
  workspaceSlug,
  hidePrivacy = false,
}: SocialLinksSectionProps) {
  const qc = useQueryClient();
  const [dialogState, setDialogState] = useState<DialogState>({ mode: "closed" });
  const [draft, setDraft] = useState<FormDraft>(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SocialLink | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // The unsaved-changes alert raised by a close attempt on a dirty draft.
  const [confirmingClose, setConfirmingClose] = useState(false);

  // Personal keeps the bare key (shared with any other consumer/invalidator); an org
  // workspace namespaces its own cache slice. Shared with the reading panel — see socialLinksKey.
  const linksKey = socialLinksKey(workspaceSlug);
  const wsOpts = workspaceSlug ? { workspace: workspaceSlug } : undefined;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: FormDraft) => createSocialLink(body, wsOpts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linksKey });
      closeDialog();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Could not save. Try again.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormDraft }) =>
      updateSocialLink(id, body, wsOpts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linksKey });
      closeDialog();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Could not save. Try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSocialLink(id, wsOpts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linksKey });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: unknown) => {
      // Keep the dialog open so the user sees the failure.
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete. Try again.",
      );
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openAdd() {
    setDraft(emptyDraft());
    setFormError(null);
    setDialogState({ mode: "add" });
  }

  function openEdit(link: SocialLink) {
    setDraft(draftOf(link));
    setFormError(null);
    setDialogState({ mode: "edit", link });
  }

  function closeDialog() {
    setDialogState({ mode: "closed" });
    setFormError(null);
  }

  /** Every way OUT of the dialog: Escape, a backdrop click and the × all arrive here through
   *  `onOpenChange`, and so does Cancel. Asks before throwing a dirty draft away. */
  function requestCloseDialog() {
    if (isPending) return;
    if (draftDirty) {
      setConfirmingClose(true);
      return;
    }
    closeDialog();
  }

  function handleSave() {
    // Re-checked here, not only at the button: a form's DEFAULT submit (Enter in a text
    // field) reaches this handler without going through the button that carries them.
    if (isPending) return;
    const blocked = socialLinkBlockedReason(draft);
    if (blocked) {
      setFormError(blocked);
      return;
    }
    if (!dirty) return;
    setFormError(null);
    if (dialogState.mode === "add") {
      createMutation.mutate({ ...draft, url: draft.url.trim() });
    } else if (dialogState.mode === "edit") {
      updateMutation.mutate({
        id: dialogState.link.id,
        body: { ...draft, url: draft.url.trim() },
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const dialogOpen = dialogState.mode !== "closed";
  const dialogTitle =
    dialogState.mode === "add" ? "Add social link" : "Edit social link";

  // Edit has a loaded baseline — gate Save on `dirty` too, so re-saving an untouched link
  // (a silent no-op write that still invalidates the list) isn't offered. Add has no
  // baseline to diff against, so it's exempt: filling the required field IS the change.
  const dirty = dialogState.mode !== "edit" || !sameLink(draft, draftOf(dialogState.link));
  // What the CLOSE gate diffs against: the state the dialog OPENED on — the loaded row for an
  // edit, the blank draft for an add. Deliberately NOT the Save gate's `dirty` above, which is
  // unconditionally true in add mode; reusing it would raise the discard alert on every Add
  // dialog the user opens and thinks better of, which is worse than the bug it fixes.
  const draftDirty =
    dialogOpen &&
    !sameLink(draft, dialogState.mode === "edit" ? draftOf(dialogState.link) : emptyDraft());
  // The same draft diff, reported to the settings registry so the exits the dialog can't see for
  // itself — reload, a link click, a rail row switch — ask before discarding.
  useReportSettingsDirty("profile-social-links", draftDirty);

  const blockedReason = socialLinkBlockedReason(draft);
  // dirty && valid ONLY — the in-flight term is applied at the button below.
  const canSave = dirty && blockedReason === null;

  // ── Shared content ─────────────────────────────────────────────────────────

  const addButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={openAdd}
      aria-label="Add social link"
    >
      <Plus data-icon="inline-start" />
      Add
    </Button>
  );

  const listContent = isLoading ? (
    <p className="py-2 text-sm text-apt-text-muted">Loading…</p>
  ) : links.length === 0 ? (
    <p className="py-2 text-sm text-apt-text-muted">
      No social links yet. Add one to show it on your card.
    </p>
  ) : (
    <List>
      {links.map((link) => {
        const level = hidePrivacy ? "only-me" : resolvePrivacyLevel(grants, "social_links", link.id);
        const label = PLATFORM_LABELS[link.platform] ?? link.platform;
        return (
          <ListItem key={link.id} className="flex-wrap gap-2 py-2">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-apt-text">
                {label}
              </span>
              {link.handle && (
                <span className="ml-2 font-mono text-xs text-apt-text-dim">
                  {link.handle}
                </span>
              )}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 truncate text-xs text-apt-text-muted transition-colors hover:text-apt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40 rounded"
                onClick={(e) => e.stopPropagation()}
              >
                {link.url}
              </a>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {!hidePrivacy && (
                <PrivacyLevelControl
                  targetTable="social_links"
                  targetId={link.id}
                  level={level}
                  ariaLabel={`${label} visibility`}
                />
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit(link)}
                aria-label={`Edit ${label}`}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="destructive-ghost"
                size="icon-sm"
                onClick={() => setDeleteTarget(link)}
                aria-label={`Delete ${label}`}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </ListItem>
        );
      })}
    </List>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {hideSectionTitle ? (
        <div className="flex flex-col gap-4">
          <div className="flex min-h-8 items-center justify-end">
            {addButton}
          </div>
          {listContent}
        </div>
      ) : (
        <DetailSection title="Social links" action={addButton}>
          {listContent}
        </DetailSection>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) requestCloseDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          >
            <Field label="Platform">
              <Select
                id="social-link-platform"
                value={draft.platform}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, platform: e.target.value }))
                }
                aria-label="Platform"
              >
                {PLATFORMS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="URL" error={formError ?? undefined}>
              <Input
                id="social-link-url"
                type="url"
                value={draft.url}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, url: e.target.value }));
                  setFormError(null);
                }}
                placeholder="https://example.com/you"
                aria-required="true"
                aria-invalid={formError != null}
                autoComplete="url"
              />
            </Field>

            <Field label="Handle (optional)">
              <Input
                id="social-link-handle"
                value={draft.handle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, handle: e.target.value }))
                }
                placeholder="@yourhandle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>

            <DialogFooter>
              {/* Say WHY Save is dark. No `dirty` term is needed to keep this quiet on an
                  untouched edit: `blockedReason` speaks only for VALIDITY, and a stored
                  link always has the URL it was created with. "Nothing has changed yet"
                  is self-explanatory; an unfilled required field is not. */}
              {blockedReason && (
                <p className="mr-auto text-sm text-apt-text-muted" role="status">
                  {blockedReason}
                </p>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={requestCloseDialog} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!canSave || isPending}
                className={
                  canSave && !isPending
                    ? "bg-apt-gold text-apt-bg hover:bg-apt-gold-bright"
                    : ""
                }
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
          {/* Discard calls `closeDialog()` directly, NOT `requestCloseDialog()`: routing back
              through the gate would re-test `draftDirty` — still true — and re-raise the alert
              forever. */}
          <UnsavedChangesAlert
            open={confirmingClose}
            onDiscard={() => {
              setConfirmingClose(false);
              closeDialog();
            }}
            onStay={() => setConfirmingClose(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertModal
        open={deleteTarget != null}
        tone="error"
        title="Remove social link?"
        description={
          deleteTarget ? (
            <>
              <span>
                {`Remove ${PLATFORM_LABELS[deleteTarget.platform] ?? deleteTarget.platform} from your card?`}
              </span>
              <DialogErrorText error={deleteError} />
            </>
          ) : undefined
        }
        confirmLabel="Remove"
        confirmVariant="destructive"
        cancelLabel="Cancel"
        busy={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            setDeleteError(null);
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </>
  );
}
