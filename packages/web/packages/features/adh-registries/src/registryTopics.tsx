'use client';

import type { ReactNode } from 'react';
import { ClipboardList, KeyRound, ListChecks, SlidersHorizontal, Users } from 'lucide-react';
import { type ResourceTopic, useRailExitGuard } from '@agentic-toolkit/resource';
import { ButtonBar } from '@agenticdevelopertoolkit/ui/blocks';
import { ErrorText } from '@agenticdevelopertoolkit/ui/components/error-text';
import { Spinner } from '@agenticdevelopertoolkit/ui/components/spinner';
import { PendingEntriesPanel } from './PendingEntriesPanel';
import { RegistryDetailsPanel } from './RegistryDetailsPanel';
import { RegistryPermissionsPanel } from './RegistryPermissionsPanel';
import { RegistryProvidersPanel } from './RegistryProvidersPanel';
import { RegistrySignupFormPanel } from './RegistrySignupFormPanel';
import type { RegistryDraftState, UseRegistryDraft } from './useRegistryDraft';

/**
 * The topics of ONE open registry, for the explorer's second level.
 *
 * A pure function of one context object, exactly like `entryTopics` beside it: the topic list
 * is then assertable without rendering anything, and the route stays a single
 * `ResourceExplorer` call rather than a component that decides what to show.
 *
 * Two groups, split by a divider, because they are two kinds of thing.
 *
 * ABOVE it, the three things an owner CONFIGURES — the registry itself (Details), the form its
 * registrants fill in (Signup Form), and who may find it or sign up (Permissions). That is what
 * the rail is for, and what the first cut of it did not do.
 *
 * BELOW it, the two views of the people those settings produce: everyone who has signed up
 * (Providers) and the ones still waiting on a decision (Submissions). Neither is a setting, and
 * they are two surfaces over the same rows on purpose — see `RegistryProvidersPanel` for why a
 * roster and a queue are not the same screen.
 *
 * Sections used to be topics — one rail row each, `…/registries/<id>/section-<id>` — which put
 * the parts of a single form at the same level of the navigator as the registry's own settings,
 * and made "is this section the signup form?" a question the rail could not answer. They are
 * now the body of the Signup Form topic, which is also what lets the whole form be previewed
 * at once (`RegistrySignupFormPanel`) instead of one section at a time.
 */

export interface RegistryTopicContext {
  /** The open registry's shared draft — every topic edits the same one. */
  editor: UseRegistryDraft;
  /** The open registry's id; `undefined` while nothing is selected. */
  registryId: string | undefined;
  /** Leave the deleted registry's pane — the route's own "back to the list". */
  onDeleted: () => void;
}

/**
 * Reproduces the two early returns the old builder opened with, in their original order, for
 * every topic body that needs a draft.
 *
 * A load failure (403 on a registry you don't own, 404 on one that's gone, an expired token)
 * never sets `draft`, so without the first check the pane is stuck on "Loading…" forever with
 * the error unreachable. It is gated on `!draft` rather than a bare `if (error)` because once
 * the initial load succeeds, `error` is reused for a *save* failure — and that one keeps the
 * form on screen with the alert inline (`RegistryEditorFrame` below) so the owner can fix the
 * draft and retry, instead of losing it behind a dead end with no more form to resubmit from.
 */
function withDraft(
  editor: UseRegistryDraft,
  body: (draft: RegistryDraftState) => ReactNode,
): ReactNode {
  if (editor.error && !editor.draft) return <ErrorText error={editor.error} className="p-6" />;
  if (!editor.draft) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-apt-text-muted">
        <Spinner />
        Loading…
      </p>
    );
  }
  return body(editor.draft);
}

/**
 * The platform's standard editing bar over a topic body, the inline alert under it, and the
 * unsaved-work guard for the whole draft.
 *
 * Every editable topic renders its own, because the draft they commit is the one the hook
 * above them holds and the explorer only ever mounts one topic pane at a time — so there is
 * exactly one Save on screen, and it saves whatever the owner has been typing in any of them.
 *
 * The GUARD is published from here rather than from `useRegistryDraft` itself for a mechanical
 * reason: `useRailExitGuard` is a no-op outside `RailHostContext`, and the hook is called by the
 * explorer's own parent, outside it. A topic body is inside. Without it, picking a different
 * registry in the rail threw away everything typed since the last Save with no prompt at all —
 * the draft's render-phase reset drops `edits` the moment the id changes, and it has no way to
 * ask first. `isDirty` is the same `dirty` the Save button reads, so what the prompt protects and
 * what the bar offers to commit are one answer.
 */
function RegistryEditorFrame({
  editor,
  children,
}: {
  editor: UseRegistryDraft;
  children: ReactNode;
}) {
  useRailExitGuard(editor.dirty ? { isDirty: () => true } : null);
  return (
    <div className="flex flex-col">
      <ButtonBar
        showCreate={false}
        showDelete={false}
        actions={{
          onCancel: editor.revert,
          canCancel: editor.dirty,
          onSave: () => void editor.save(),
          // A draft the server would refuse is not savable, and the bar is where that has to be
          // said: Save used to be live on a draft carrying a blank or duplicate field key, ran
          // the registry PATCH and every field write ahead of the bad row, and only then took a
          // bare 400. The reason is spelled out under the bar rather than hidden in a tooltip on
          // a disabled button, because it names a field the owner has to go and fix.
          canSave: editor.dirty && editor.saveBlock === null,
          saving: editor.saving,
        }}
      />
      <ErrorText error={editor.error} className="px-6 pt-2" />
      {editor.saveBlock !== null && editor.error === null && (
        <p className="px-6 pt-2 text-sm text-apt-text-muted">{editor.saveBlock}</p>
      )}
      <div className="flex flex-col gap-4 p-6">{children}</div>
    </div>
  );
}

export function registryTopics({
  editor, registryId, onDeleted,
}: RegistryTopicContext): ResourceTopic[] {
  return [
    {
      id: 'details',
      label: 'Details',
      icon: <SlidersHorizontal size={16} aria-hidden />,
      render: (_scopedId, titleFor) =>
        withDraft(editor, (draft) => (
          <RegistryEditorFrame editor={editor}>
            <RegistryDetailsPanel
              title={titleFor('Details')}
              editor={editor}
              draft={draft}
              onDeleted={onDeleted}
            />
          </RegistryEditorFrame>
        )),
    },
    {
      id: 'signup-form',
      // Named for what a registrant meets, not for how it is stored. The owner is building the
      // form somebody fills in to get listed; "Sections" named the storage and left the purpose
      // unsaid, which is what made the old rail unreadable.
      label: 'Signup Form',
      icon: <ClipboardList size={16} aria-hidden />,
      render: (_scopedId, titleFor) =>
        withDraft(editor, (draft) => (
          <RegistryEditorFrame editor={editor}>
            <RegistrySignupFormPanel
              title={titleFor('Signup Form')}
              editor={editor}
              draft={draft}
            />
          </RegistryEditorFrame>
        )),
    },
    {
      id: 'permissions',
      label: 'Permissions',
      icon: <KeyRound size={16} aria-hidden />,
      // The three things the owner CONFIGURES, then the people their configuration produced.
      dividerAfter: true,
      render: (_scopedId, titleFor) =>
        withDraft(editor, (draft) => (
          <RegistryEditorFrame editor={editor}>
            <RegistryPermissionsPanel
              title={titleFor('Permissions')}
              editor={editor}
              draft={draft}
            />
          </RegistryEditorFrame>
        )),
    },
    {
      id: 'providers',
      // "Providers", not the registry's own `entryTerm` ("coaches", "consultants"): the rail's
      // vocabulary is the product's and is the same in every registry an owner opens, while the
      // entry term is what the PUBLIC profile calls them. A rail row that renamed itself per
      // registry would make the one navigator an owner uses across all of theirs unlearnable.
      label: 'Providers',
      icon: <Users size={16} aria-hidden />,
      // Outside `RegistryEditorFrame` for the same reason Submissions is: removing a registrant
      // is its own request against its own row, and a Save bar here would offer to commit a
      // registry draft that has nothing to do with it.
      render: (_scopedId: string | undefined, titleFor: (label: string) => string) =>
        registryId ? (
          <div className="p-6">
            <RegistryProvidersPanel
              title={titleFor('Providers')}
              registryId={registryId}
              client={editor.client}
            />
          </div>
        ) : null,
    },
    {
      id: 'pending',
      // "Submissions", not "Waiting for review": the rail names the THING a topic holds —
      // Details, Signup Form, Submissions — and the other labels are nouns. "Waiting for
      // review" named a state instead, and a state nobody outside this code calls it: the
      // owner chose "Anyone, but I approve each one" and the registrant was told their listing
      // was "submitted", so neither of them has ever seen the word "review".
      label: 'Submissions',
      icon: <ListChecks size={16} aria-hidden />,
      // Outside `RegistryEditorFrame`, deliberately: approving is its own request against its
      // own row, and a Save bar over it would offer to commit a registry draft that has
      // nothing to do with the decision being made.
      render: (_scopedId: string | undefined, titleFor: (label: string) => string) =>
        registryId ? (
          <div className="p-6">
            <PendingEntriesPanel
              title={titleFor('Submissions')}
              registryId={registryId}
              client={editor.client}
            />
          </div>
        ) : null,
    },
  ];
}
