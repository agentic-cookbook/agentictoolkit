"use client";

import { type ReactElement } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@agentic-toolkit/ui/components/dialog";
import { Button } from "@agentic-toolkit/ui/components/button";
import { AdminNotesModal as SharedAdminNotesModal } from "@agentic-toolkit/ui/blocks/admin-notes-modal";
import { useEcoRowNotes, useEcoSaveNotes } from "@agentic-toolkit/data/ecosystems";

/**
 * Thin react-query wrapper around the shared, prop-driven staged notes editor,
 * scoped to an ecosystem's rdid (mirrors the admin wrapper, but on the ecosystem-
 * owner routes).
 *
 * Fetches the subject's notes, gating on the load so the shared editor mounts (and
 * seeds its staged working copy) only once the loaded notes are available. The
 * subject `key` forces a fresh working copy when the target row changes.
 *
 * Save → PUT via useEcoSaveNotes, then close + invalidate on success.
 */
export function AdminNotesModal({ ecosystemRdid, open, onClose, author, subjectTable, subjectId }: {
  ecosystemRdid: string;
  open: boolean;
  onClose: () => void;
  author: string;
  subjectTable: string;
  subjectId: string;
}): ReactElement {
  const notesQ = useEcoRowNotes(ecosystemRdid, subjectTable, subjectId);
  const save = useEcoSaveNotes(ecosystemRdid);

  // Gate the shared editor on the load: its working copy seeds AT MOUNT from the
  // notes prop, so it must not mount until the loaded notes are in hand.
  if (notesQ.isPending || notesQ.data === undefined) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="text-apt-gold">Admin notes</DialogTitle></DialogHeader>
          <div className="flex h-[420px] items-center justify-center">
            <p className="text-sm text-apt-text-dim">Loading…</p>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <SharedAdminNotesModal
      key={`${subjectTable}:${subjectId}`}
      open={open}
      onClose={onClose}
      author={author}
      notes={notesQ.data}
      onSave={(notes) => save.mutate({ subjectTable, subjectId, notes }, { onSuccess: onClose })}
      busy={save.isPending}
    />
  );
}
