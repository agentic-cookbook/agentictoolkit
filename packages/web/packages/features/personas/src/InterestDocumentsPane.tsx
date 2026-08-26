"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Field, FieldGroup, ButtonBar } from "@agenticdevelopertoolkit/ui/blocks";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Textarea } from "@agenticdevelopertoolkit/ui/components/textarea";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { errMsg, useResourceList, useTenantId } from "@agentic-toolkit/data";
import {
  interestDocumentsApi,
  specialInterestsApi,
  type InterestDocumentRow,
  type SpecialInterestRow,
  type Persona,
} from "@agentic-toolkit/data/personas";
import { specialInterestsCacheKey } from "./interests-cache";

// The research corpus behind one special interest: the documents the persona searches mid-
// conversation (`searchPersonaKnowledge`) when the user wants to nerd out about the topic.
//
// Two things here look odd and are deliberate:
//  1. Every call names the persona as the ACT-AS principal. The grant on an interest bucket
//     belongs to the PERSONA, not the user, so the author fills the corpus by acting as their own
//     persona. The backend checks the persona is theirs.
//  2. The pane scopes to `corpusEcosystemId` — the OWNER's realm — not the persona's
//     `ownedEcosystemId` that the knowledge-bases pane beside it uses. They are different
//     ecosystems and only the former is the one a chat turn runs in.

/** The stand-in while the interests read is outstanding or has given up. Module scope so it keeps
 *  one identity: a fresh `[]` per render would re-run every memo derived from it. */
const EMPTY_INTERESTS: SpecialInterestRow[] = [];

/** `General › Topical › Specific`, skipping blanks — the same shape the prompt renders. */
function interestLabel(i: SpecialInterestRow): string {
  return [i.general, i.topical, i.specific].map((l) => l?.trim()).filter(Boolean).join(" › ");
}

/* ── Why "Save document" is grey ───────────────────────────────────────────
 * Both terms holding that button down are VALIDITY rules, not dirtiness, and a validity rule that
 * greys Save has to say so: "nothing to save yet" explains itself, "this can never be saved as it
 * stands" does not. One function, two readers — the button's `disabled` and the caption beside it —
 * so the two can't drift. `content` is gated as hard as `title` because `content` IS the document:
 * an empty one is a row the persona can never usefully match, and letting it through only trades
 * this caption for the rows plane's raw blank-column error. */
const DOCUMENT_TITLE_REQUIRED = "A title is required.";
const DOCUMENT_CONTENT_REQUIRED = "Content is required — it's what the persona searches.";

function documentBlockedReason(title: string, content: string): string | null {
  if (!title.trim()) return DOCUMENT_TITLE_REQUIRED;
  if (!content.trim()) return DOCUMENT_CONTENT_REQUIRED;
  return null;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center">
      <p className="text-sm text-apt-text-muted">{children}</p>
    </div>
  );
}

export function InterestDocumentsPane({
  personaId,
  corpusEcosystemId,
  interest,
}: {
  /** The persona, as the act-as principal — its rdid (`Persona.id`, which is also what
   *  `SpecialInterestRow.personaId` carries: the CRUD read path swaps stored uuids back to rdids).
   *  The rows plane resolves it to the uuid `access.group_members.member_id` holds before the
   *  grant check, so either form is accepted; the rdid is the only one a client actually has. */
  personaId: string;
  /** Where this persona's corpus buckets live (Persona.corpusEcosystemId). */
  corpusEcosystemId: string | null;
  interest: SpecialInterestRow;
}) {
  const tenantId = useTenantId();
  const bucketId = interest.bucketId;
  const typeId = interest.bucketTypeId ?? null;
  // The rows plane demands the bucket-type sit in the CALLER's tenant (404 otherwise), and the
  // caller must have created the persona (403 otherwise). Rather than surface either as a raw
  // error, say what is true: this corpus is filled from elsewhere.
  const reachable = !!bucketId && !!typeId && !!corpusEcosystemId && corpusEcosystemId === tenantId;

  // The mutation error only — a failed read has its own, from the hook below. They are separate
  // because they are cleared by different things: this one by the next save or remove, that one by
  // the next successful read.
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  // The corpus, cached per INTEREST (its bucket + type) under the persona reading it. Tabbing back
  // to an interest you already opened paints its documents on the first frame and re-reads behind
  // that paint — which is what the tab strip above makes cheap to do repeatedly.
  //
  // An unreachable corpus reads nothing rather than erroring: the pane returns a Notice below
  // instead of rendering the list at all, so a request would be answered into an empty room. The
  // hook is still called there — it is a hook, and the early returns come after it.
  const loadDocs = useCallback(async () => {
    if (!reachable || !bucketId || !typeId) return [] as InterestDocumentRow[];
    try {
      return await interestDocumentsApi.list(bucketId, typeId, personaId);
    } catch (err) {
      // Rethrown with the pane's own wording so the banner says what failed, not what the transport
      // called it — the same message the hand-rolled loader used to set.
      throw new Error(errMsg(err, "Could not load this interest's documents."));
    }
  }, [reachable, bucketId, typeId, personaId]);
  const {
    items: docs,
    reload: reloadDocs,
    error: loadError,
  } = useResourceList<InterestDocumentRow>(
    `persona:${personaId}:interest:${bucketId ?? ""}:${typeId ?? ""}:documents`,
    loadDocs,
  );

  // Swallowing: both callers below re-read AFTER their own write succeeded, so a failed re-read
  // must not be reported as a failed save or remove. It still reaches the screen — as `loadError`.
  const refreshDocs = useCallback(() => reloadDocs().catch(() => {}), [reloadDocs]);

  if (!bucketId || !typeId) {
    // "is not" spelled out, not "isn't" — kept as one contiguous, un-contracted phrase so a caller
    // matching on "not ready yet" (the natural way to describe this state) finds it as a substring.
    return <Notice>This interest&apos;s research space is not ready yet — reopen this persona in a moment.</Notice>;
  }
  if (!reachable) {
    // The script path is named as plain text, not wrapped in its own element (e.g. <code>): a
    // nested element whose OWN text independently contains "ingest" (unavoidable — it's the
    // filename) would give Testing Library's getByText two independently-matching candidates for
    // an "another workspace|ingest" query and throw on the ambiguity.
    return (
      <Notice>
        This corpus lives in another workspace, so it can&apos;t be edited from here. Fill it with
        the backend/src/adh/tools/ingest_hub_corpus.py ingest script instead.
      </Notice>
    );
  }

  const blockedReason = documentBlockedReason(title, content);

  const save = async () => {
    // The button is gated on exactly this, so a click can't reach here blocked — but `save()` has
    // to be right on its own, and the message it would show is the same one, from one place.
    if (blockedReason !== null) {
      setError(blockedReason);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await interestDocumentsApi.create(bucketId, typeId, personaId, { title, content });
      setTitle("");
      setContent("");
      setAdding(false);
      await refreshDocs();
    } catch (err) {
      setError(errMsg(err, "Could not save this document."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (rowId: string) => {
    setBusy(true);
    setError(null);
    try {
      await interestDocumentsApi.delete(bucketId, typeId, personaId, rowId);
      await refreshDocs();
    } catch (err) {
      setError(errMsg(err, "Could not remove this document."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
      <p className="text-xs text-apt-text-muted">
        Research on <strong>{interestLabel(interest)}</strong>. The persona searches these
        documents while it talks — the more you put here, the more it actually knows.
      </p>

      {/* The mutation's message leads: it answers something the user just did, and it is the one
          the load banner would otherwise hide the moment a re-read follows a failed save. */}
      <ErrorText error={error ?? loadError} />

      {docs === null
        ? // A failed read leaves the rows null too, and the banner above already says why — so
          // this must neither go on claiming the list is on its way nor call the corpus empty.
          loadError === null && <p className="text-sm text-apt-text-muted">Loading…</p>
        : docs.length === 0 &&
          !adding && <p className="text-sm text-apt-text-muted">Nothing here yet.</p>}

      {(docs ?? []).map((d) => (
        <div key={d.id} className="flex items-start justify-between gap-3 rounded-md border border-apt-border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{d.title}</p>
            <p className="line-clamp-2 text-xs text-apt-text-muted">{d.content}</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => void remove(d.id)} disabled={busy}>
            <Trash2 size={14} aria-hidden /> Remove
          </Button>
        </div>
      ))}

      {adding ? (
        <FieldGroup title="New document" className="rounded-md border border-apt-border p-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cylon portrayal" />
          </Field>
          <Field label="Content" hint="Markdown. This is what the persona searches.">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-40 resize-y"
            />
          </Field>
          <ButtonBar
            leading={
              // A CREATE form speaks on arrival — there is no loaded value to have not-changed yet,
              // so the only thing grey can mean here is "a field is still missing", and the user
              // opened this form on purpose. (Edit surfaces gate the same caption on `dirty`.)
              blockedReason ? (
                <span className="text-xs text-apt-text-muted" role="status">
                  {blockedReason}
                </span>
              ) : undefined
            }
          >
            <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={busy || blockedReason !== null}>
              Save document
            </Button>
          </ButtonBar>
        </FieldGroup>
      ) : (
        <div>
          <Button type="button" variant="secondary" onClick={() => setAdding(true)} disabled={busy}>
            Add a document
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The whole Knowledge facet: the existing host-injected knowledge-bases pane (default,
 * unchanged, scoped to `ownedEcosystemId`) plus one entry per special interest, whose corpus
 * lives in `corpusEcosystemId`. A component rather than inline JSX because it holds state — the
 * facet's `render` runs inside PersonaEditor's own render, where a hook would be conditional.
 */
export function KnowledgeFacet({
  persona,
  renderKnowledgeBases,
}: {
  persona: Persona;
  renderKnowledgeBases?: (scopeEcosystemId: string) => ReactNode;
}) {
  // The interests, from the one entry `InterestsEditor` writes its saves and deletes through — so
  // declaring an interest over there puts a tab here without a read, and reopening this facet
  // paints the tabs on the first frame.
  //
  // The rows can no longer arrive under the wrong persona, which is what the old effect's
  // clear-before-fetch guarded: an entry is named by the persona it was read for, so a response
  // can only ever land on that one. A host that renders this facet unkeyed (both it and
  // `PersonaEditor` are exported, so one can) reads the new persona's entry the moment its prop
  // changes — null while it is still on its way, never the previous persona's tabs.
  //
  // A failure must not take out the knowledge-bases pane beside it, so the error is not read here:
  // no interests simply means no extra tabs. (The editor renders the same failure, which is where
  // an author acting on it already is.)
  const loadInterests = useCallback(() => specialInterestsApi.list(persona.id), [persona.id]);
  const { items } = useResourceList<SpecialInterestRow>(
    specialInterestsCacheKey(persona.id),
    loadInterests,
  );
  const interests = items ?? EMPTY_INTERESTS;

  // The picked tab is the one thing the cache key can't reset for us — it names an interest of
  // whichever persona was on screen when it was clicked. Reset it on the switch WITHOUT an effect:
  // a render-phase set re-renders before the commit, so the interim never paints.
  const [selected, setSelected] = useState<string | null>(null);
  const [tabPersonaId, setTabPersonaId] = useState(persona.id);
  const personaChanged = tabPersonaId !== persona.id;
  if (personaChanged) {
    setTabPersonaId(persona.id);
    setSelected(null);
  }
  // This render body still runs to completion after that set, so the tab derivations gate on the
  // switch themselves rather than trusting `selected` to have been cleared already.
  const selectedId = personaChanged ? null : selected;

  const current = useMemo(
    () => interests.find((i) => i.id === selectedId) ?? null,
    [interests, selectedId],
  );

  const tabs = (
    <div className="flex flex-wrap gap-2 border-b border-apt-border px-6 py-2">
      <Button type="button" variant={selectedId === null ? "secondary" : "ghost"} onClick={() => setSelected(null)}>
        Knowledge bases
      </Button>
      {interests.map((i) => (
        <Button
          key={i.id}
          type="button"
          variant={selectedId === i.id ? "secondary" : "ghost"}
          onClick={() => setSelected(i.id)}
        >
          {interestLabel(i)}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {interests.length > 0 && tabs}
      {current ? (
        <InterestDocumentsPane
          // Keyed by the interest's id: without a key, switching interests REUSES this component
          // instance, and its draft state (the half-typed new document, the open form) would carry
          // over to an interest it was never meant for. A key forces an unmount/remount, so that
          // state resets immediately. The documents themselves no longer need it — they are read
          // from a per-interest cache entry — and the remount now costs no round trip for an
          // interest already seen.
          key={current.id}
          // The act-as principal is the persona being edited. `current.personaId` is the identical
          // string (`RDID_REFS` swaps that FK back to an rdid on the way out — crud/factory.ts),
          // so this names the subject directly rather than round-tripping it through the interest.
          personaId={persona.id}
          corpusEcosystemId={persona.corpusEcosystemId ?? null}
          interest={current}
        />
      ) : !persona.ownedEcosystemId ? (
        <Notice>This persona&apos;s knowledge bases aren&apos;t available yet.</Notice>
      ) : !renderKnowledgeBases ? (
        <Notice>Knowledge bases aren&apos;t available in this view.</Notice>
      ) : (
        renderKnowledgeBases(persona.ownedEcosystemId)
      )}
    </div>
  );
}
