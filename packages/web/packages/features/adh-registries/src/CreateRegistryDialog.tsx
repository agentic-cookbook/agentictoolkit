'use client';

import type { RegistryRow } from '@agentic-toolkit/registry/client';
import { isReservedSlugAnywhere } from '@agentic-toolkit/adh-registry';
import { CreateResourceDialog } from '@agentic-toolkit/resource';
import { Field } from '@agenticdevelopertoolkit/ui/blocks';
import { ErrorText } from '@agenticdevelopertoolkit/ui/components/error-text';
import { Input } from '@agenticdevelopertoolkit/ui/components/input';
import { registryPublicAddress } from './publicAddress';
import { SLUG_MAX, normalizeSlugInput, slugProblem, slugify } from './slug';
import { useRegistryClient } from './useRegistryClient';

/**
 * The draft the dialog edits. `slugTouched` is part of it rather than component state
 * because `CreateResourceDialog` owns the draft: the slug tracks the name until the owner
 * edits it, and the flag that says so has to survive in the same object the dialog hands
 * back on every change. The slug is immutable after create — `registryUpdate` omits it —
 * so silently rewriting a deliberate choice is a mistake there is no screen to undo.
 */
interface RegistryDraft {
  name: string;
  slug: string;
  slugTouched: boolean;
}

/**
 * The one authoritative "slug this will create" — trimmed once, here. The box's own value
 * keeps a mid-typed trailing dash on purpose (see `normalizeSlugInput`), so a dash stays
 * typeable; everything that validates, shows, or submits the slug reads this instead, so
 * none of them can promise or enforce a different string than what actually gets created.
 */
function boxValue(draft: RegistryDraft): string {
  return draft.slugTouched ? draft.slug : slugify(draft.name);
}
function submittedSlug(draft: RegistryDraft): string {
  return boxValue(draft).replace(/^-+|-+$/g, '');
}

/**
 * Why the slug in the box cannot be used, or `null` — the half of the gate that is safe to
 * show WHILE the owner types. Both rules go quiet on a blank slug (`slugProblem`'s own
 * "blank is not yet"), so an owner who has only just opened the form is not greeted by a
 * complaint about a box they have not reached.
 */
function slugTrouble(draft: RegistryDraft): string | null {
  const slug = submittedSlug(draft);
  // A new registry is not bound to a site yet (`boundSiteId: null`) and its slug is permanent,
  // so a slug that collides only on the OTHER site would strand it there forever. That is a hub
  // product fact and belongs here; the fold over the per-site lists is a property of the lists
  // and lives beside them, in `@agentic-toolkit/adh-registry`.
  //
  // The message states the RULE, not a host. `isReservedSlugAnywhere` ORs every site's list, so
  // naming one site states a reason that is only true while the lists happen to be equal — and
  // `@agentic-toolkit/adh-registry`'s own docblock says they are kept per-site "precisely so
  // they can diverge". On the day one does, a registrant would be refused a PERMANENT slug for a
  // stated reason they could check and find false, with no way to appeal it.
  if (slug !== '' && isReservedSlugAnywhere(slug)) {
    return (
      `“${slug}” is a reserved page name. A registry's slug is permanent and ` +
      'it can be bound to any site later, so it has to be free on all of them — pick another.'
    );
  }
  return slugProblem(slug);
}

/**
 * What is wrong with this draft, or `null`. One function, read by both the click-time
 * `validate` and the `saveEnabled` gate, so the button's disabled state and the message it
 * would have shown can never disagree about what is acceptable.
 *
 * The two "you have not filled this in yet" cases are here rather than in `slugTrouble`
 * because they describe an UNFINISHED form, not a wrong answer: they are what keeps Save
 * dead, and shown live they would accuse the owner of a mistake they are still in the
 * middle of not making.
 */
function problemWith(draft: RegistryDraft): string | null {
  if (draft.name.trim() === '') return 'Give the registry a name.';
  if (submittedSlug(draft) === '') return 'Give the registry a web address.';
  return slugTrouble(draft);
}

export interface CreateRegistryDialogProps {
  onClose: () => void;
  /** Handed the new registry so the explorer can select it. */
  onCreated: (registry: RegistryRow) => void;
}

/** The platform's shared create modal, wearing the registry's two permanent-slug rules. */
export function CreateRegistryDialog({ onClose, onCreated }: CreateRegistryDialogProps) {
  const client = useRegistryClient();
  return (
    <CreateResourceDialog<RegistryDraft, RegistryRow>
      ariaLabel="New registry"
      heading="New registry"
      blank={() => ({ name: '', slug: '', slugTouched: false })}
      validate={problemWith}
      saveEnabled={(draft) => problemWith(draft) === null}
      create={(draft) =>
        client.createRegistry({ slug: submittedSlug(draft), name: draft.name.trim() })
      }
      onClose={onClose}
      onCreated={onCreated}
      renderForm={(draft, onChange, error) => (
        <>
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
          </Field>
          <Field
            label="Web address"
            hint={`${registryPublicAddress(submittedSlug(draft) || '…')} — permanent, so choose it now.`}
          >
            <Input
              value={boxValue(draft)}
              maxLength={SLUG_MAX}
              onChange={(e) =>
                onChange({ ...draft, slugTouched: true, slug: normalizeSlugInput(e.target.value) })
              }
            />
          </Field>
          {/* One line for every reason Save can refuse. The slug rules are shown as they are
              broken rather than at the click, because Save is DEAD while one is — the owner
              would otherwise have a button that will not move and no sentence saying why. A
              rejected create arrives through the dialog's own `error`, which the platform's
              create dialogs all render here; the live rule wins when both are on, since it is
              about what is in the box now and the other is about a submission already gone. */}
          <ErrorText error={slugTrouble(draft) ?? error} />
        </>
      )}
    />
  );
}
