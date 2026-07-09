"use client";

import type { ReactElement } from "react";
import { NotesAndHistory as SharedNotesAndHistory } from "@agentic-toolkit/ui/blocks/notes-and-history";
import { useEcoRowNotes, useEcoRowHistory } from "@agentic-toolkit/data/ecosystems";

/**
 * Thin react-query wrapper around the shared presentational block, scoped to an
 * ecosystem's rdid. Fetches the subject's notes + history from the ecosystem-owner
 * routes and threads them into the shared component (mirrors the admin wrapper).
 */
export function NotesAndHistory({
  ecosystemRdid,
  subjectTable,
  subjectId,
}: {
  ecosystemRdid: string;
  subjectTable: string;
  subjectId: string;
}): ReactElement {
  const notes = useEcoRowNotes(ecosystemRdid, subjectTable, subjectId);
  const history = useEcoRowHistory(ecosystemRdid, subjectTable, subjectId);
  return (
    <SharedNotesAndHistory
      notes={notes.data ?? []}
      history={history.data ?? []}
      notesLoading={notes.isPending}
      historyLoading={history.isPending}
    />
  );
}
