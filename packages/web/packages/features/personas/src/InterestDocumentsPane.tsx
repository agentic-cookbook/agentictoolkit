"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Field, FieldGroup, ButtonBar } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { Button } from "@agentic-toolkit/ui/components/button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { errMsg, useTenantId } from "@agentic-toolkit/data";
import {
  interestDocumentsApi,
  specialInterestsApi,
  type InterestDocumentRow,
  type SpecialInterestRow,
  type Persona,
} from "@agentic-toolkit/data/personas";

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

/** `General › Topical › Specific`, skipping blanks — the same shape the prompt renders. */
function interestLabel(i: SpecialInterestRow): string {
  return [i.general, i.topical, i.specific].map((l) => l?.trim()).filter(Boolean).join(" › ");
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
  /** MUST be the persona's raw uuid (`SpecialInterestRow.personaId`), never its rdid — sent as the
   *  act-as principal. The rows plane's grant check (routes/bucketsData.ts's `canBucketAccess`
   *  call sites) matches this value, UNRESOLVED, against `access.group_members.member_id`, which
   *  provisioning stamped with the persona's uuid (`provision-interest-bucket.ts`). The persona's
   *  own `id` from `GET /persona/personas` is an rdid and would silently 403 every call below —
   *  see `interest-documents.ts`'s `actingAs()` doc for the full trace. */
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

  const [docs, setDocs] = useState<InterestDocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!reachable || !bucketId || !typeId) return;
    try {
      setDocs(await interestDocumentsApi.list(bucketId, typeId, personaId));
      setError(null);
    } catch (err) {
      setError(errMsg(err, "Could not load this interest's documents."));
    }
  }, [reachable, bucketId, typeId, personaId]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await interestDocumentsApi.create(bucketId, typeId, personaId, { title, content });
      setTitle("");
      setContent("");
      setAdding(false);
      await reload();
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
      await reload();
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

      <ErrorText error={error} />

      {docs.length === 0 && !adding && (
        <p className="text-sm text-apt-text-muted">Nothing here yet.</p>
      )}

      {docs.map((d) => (
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
          <ButtonBar>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={busy || !title.trim()}>
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
  const [interests, setInterests] = useState<SpecialInterestRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    specialInterestsApi
      .list(persona.id)
      .then((rows) => {
        if (live) setInterests(rows);
      })
      // A failure here must not take out the knowledge-bases pane beside it: no interests
      // simply means no extra tabs.
      .catch(() => {
        if (live) setInterests([]);
      });
    return () => {
      live = false;
    };
  }, [persona.id]);

  const current = useMemo(
    () => interests.find((i) => i.id === selected) ?? null,
    [interests, selected],
  );

  const tabs = (
    <div className="flex flex-wrap gap-2 border-b border-apt-border px-6 py-2">
      <Button type="button" variant={selected === null ? "secondary" : "ghost"} onClick={() => setSelected(null)}>
        Knowledge bases
      </Button>
      {interests.map((i) => (
        <Button
          key={i.id}
          type="button"
          variant={selected === i.id ? "secondary" : "ghost"}
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
          // instance and its `docs` state carries over — the previous interest's documents stay on
          // screen under the new heading until the new fetch lands (or forever, if it fails). A key
          // forces React to unmount/remount on switch, so state resets immediately.
          key={current.id}
          // The act-as principal is the persona's raw UUID (`current.personaId`), NOT `persona.id`
          // — see InterestDocumentsPane's `personaId` doc comment for why an rdid here is a silent
          // 403. `RDID_REFS` (crud/policy.ts) only rewrites values on the WRITE path, so this list
          // response's `personaId` is the raw uuid stored on the row — exactly what
          // `access.group_members.member_id` holds.
          personaId={current.personaId}
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
