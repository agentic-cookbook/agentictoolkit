'use client';

import { Field, FieldGroup } from '@agenticdevelopertoolkit/ui/blocks';
import { Select } from '@agenticdevelopertoolkit/ui/components/select';
import type { RegistryVisibility, SubmissionPolicy } from '@agentic-toolkit/registry/client';
import type { RegistryDraftState, UseRegistryDraft } from './useRegistryDraft';

// Order chosen for the copy below ("Only me" first, the default a brand-new registry starts
// on — `visibility.default('private')`, `registries.ts:53`), not the client's
// REGISTRY_VISIBILITIES declaration order — same convention as EntryPublishPanel's
// VISIBILITY_LABEL. `Record`'s exhaustiveness means a member REGISTRY_VISIBILITIES gains
// later and this map does not is a compile error, not a silently missing <option>; a typo in
// a key is a compile error too, not a dead one.
const REGISTRY_VISIBILITY_LABEL: Record<RegistryVisibility, string> = {
  private: 'Only me',
  hub: 'Hub members',
  public: 'Anyone',
};
const REGISTRY_VISIBILITY_ORDER = Object.keys(REGISTRY_VISIBILITY_LABEL) as RegistryVisibility[];

// Two options, not three. The server's enum is `['open','reviewed']` (spec D11,
// `registries.ts:42`) — an `invite` option would be a control whose only outcome is a 400
// the owner cannot act on.
const SUBMISSION_POLICY_LABEL: Record<SubmissionPolicy, string> = {
  open: 'Anyone signed in',
  reviewed: 'Anyone, but I approve each one',
};
const SUBMISSION_POLICY_ORDER = Object.keys(SUBMISSION_POLICY_LABEL) as SubmissionPolicy[];

export interface RegistryPermissionsPanelProps {
  /** The topic's own title, from the explorer's `titleFor`. */
  title: string;
  editor: UseRegistryDraft;
  draft: RegistryDraftState;
}

/**
 * Who may reach this registry, and who may sign up to it.
 *
 * Two settings, one topic, because they are the two halves of one question the owner asks
 * once — the gate on the door and the gate on the form behind it — and neither is answerable
 * without the other in view: a `public` registry with a `reviewed` policy is a very different
 * thing from a `public` one that anyone can post to, and until now those two selects sat at
 * the bottom of a pane of unrelated registry basics where nothing said they were related.
 */
export function RegistryPermissionsPanel({
  title, editor, draft,
}: RegistryPermissionsPanelProps) {
  return (
    <FieldGroup title={title}>
      <Field label="Who can find it">
        <Select
          value={draft.registry.visibility}
          onChange={(e) => editor.setRegistry({ visibility: e.target.value as RegistryVisibility })}
        >
          {REGISTRY_VISIBILITY_ORDER.map((v) => (
            <option key={v} value={v}>{REGISTRY_VISIBILITY_LABEL[v]}</option>
          ))}
        </Select>
      </Field>

      <Field label="Who can add a listing">
        <Select
          value={draft.registry.submissionPolicy}
          onChange={(e) =>
            editor.setRegistry({ submissionPolicy: e.target.value as SubmissionPolicy })
          }
        >
          {SUBMISSION_POLICY_ORDER.map((p) => (
            <option key={p} value={p}>{SUBMISSION_POLICY_LABEL[p]}</option>
          ))}
        </Select>
      </Field>
    </FieldGroup>
  );
}
