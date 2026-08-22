"use client";

import { useState, type SubmitEvent } from "react";
import { ErrorText, useAction } from "@agentic-toolkit/crud";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@agentic-toolkit/ui/components/dialog";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { RdidEditor } from "@agentic-toolkit/ui/components/rdid-editor";
import { validateLeaf } from "@agentic-toolkit/ui/lib/rdid";
import { organizationsApi } from "@agentic-toolkit/data/organizations";
import { useReportSettingsDirty } from "@agentic-toolkit/resource";

/** Create + provision a new organization, then hand its slug back so the home
 *  view can invalidate the workspace list and navigate to the new org's home.
 *  Mirrors the field/error pattern of OrganizationsPage's create section
 *  (useAction + ErrorText + Field/Input). */
export function NewOrganizationModal({
  open,
  workspaceSlug,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** The workspace the org is created FROM, and therefore the one that will OWN it — creating
   *  from an org workspace makes that org the new org's owner. Required rather than defaulted,
   *  so no host can silently mint an org into the creator's personal workspace by omission. */
  workspaceSlug: string;
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();

  const ready = slug.trim() !== "" && validateLeaf(slug) === null && name.trim() !== "";

  // Gated on `open`, not on the fields alone: this component stays MOUNTED with its state intact
  // when the dialog closes, so an un-gated report would keep the guard armed over text nobody can
  // see and prompt on a navigation minutes later. While it IS open, a half-entered slug and name
  // are real work — the slug has to satisfy `validateLeaf` and is permanent once provisioned.
  useReportSettingsDirty(
    "new-organization",
    open && (slug.trim() !== "" || name.trim() !== ""),
  );

  function submit(event: SubmitEvent) {
    event.preventDefault();
    void run(async () => {
      // The namespace rdid is derived server-side as `org.<slug>`, so there is nothing to enter.
      const result = await organizationsApi.create(
        {
          slug: slug.trim(),
          name: name.trim(),
        },
        workspaceSlug,
      );
      onCreated(result.organization.slug);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-apt-gold">New Organization</DialogTitle>
          <DialogDescription>
            Provisions a namespace, an admin team, and a default ecosystem. You become its admin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <RdidEditor
            label="slug *"
            prefix="org."
            value={slug}
            placeholder="acme"
            hint="Only the name is editable — the org. namespace prefix is added server-side."
            error={slug ? validateLeaf(slug) : undefined}
            onChange={setSlug}
          />
          <Field label="name *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
          </Field>
          <ErrorText error={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || !ready}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
