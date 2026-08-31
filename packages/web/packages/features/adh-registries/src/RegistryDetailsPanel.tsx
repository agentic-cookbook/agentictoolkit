'use client';

import { DeleteEntitySection } from '@agentic-toolkit/adh-ui/blocks';
import { Field, FieldGroup, TagSetField } from '@agenticdevelopertoolkit/ui/blocks';
import { Checkbox } from '@agenticdevelopertoolkit/ui/components/checkbox';
import { Input } from '@agenticdevelopertoolkit/ui/components/input';
import { Label } from '@agenticdevelopertoolkit/ui/components/label';
import { Textarea } from '@agenticdevelopertoolkit/ui/components/textarea';
import type { RegistryDraftState, UseRegistryDraft } from './useRegistryDraft';

export interface RegistryDetailsPanelProps {
  /** The topic's own title, from the explorer's `titleFor` — "Details (Coaches registry)". */
  title: string;
  editor: UseRegistryDraft;
  draft: RegistryDraftState;
  /** Run once the registry is gone, to leave the pane that was editing it. */
  onDeleted: () => void;
}

/**
 * The registry ITSELF — what it is called, what it is about, how it is found, and the one
 * place it can be destroyed from.
 *
 * The line this pane is drawn on is whose settings these are. Everything here is the OWNER's
 * description of their own registry; the form a registrant fills in is `RegistrySignupFormPanel`
 * and who may fill it in is `RegistryPermissionsPanel`. Those three used to share one pane and
 * one long scroll, which made "who can find it" (a registry setting) sit beside "who can add a
 * listing" (a signup rule) as if they were the same kind of decision.
 */
export function RegistryDetailsPanel({
  title, editor, draft, onDeleted,
}: RegistryDetailsPanelProps) {
  return (
    <FieldGroup title={title}>
      <Field label="Name">
        <Input
          value={draft.registry.name}
          onChange={(e) => editor.setRegistry({ name: e.target.value })}
        />
      </Field>

      {/*
        Shown, and not editable. The slug is this registry's public address — other people's
        bookmarks and other systems have already resolved it — so the server's update schema
        does not accept it at all (`registryUpdate`, registries.ts). `readOnly` rather than
        `disabled` because the owner's reason for looking at it is to COPY it, and a disabled
        input cannot be selected.
      */}
      <Field label="Address" hint="Fixed once the registry exists — links people already have resolve through it.">
        <Input value={draft.registry.slug} readOnly />
      </Field>

      <Field label="What this registry is for">
        <Textarea
          rows={3}
          value={draft.registry.purpose}
          onChange={(e) => editor.setRegistry({ purpose: e.target.value })}
        />
      </Field>

      <Field label="Description">
        <Textarea
          rows={5}
          value={draft.registry.description}
          onChange={(e) => editor.setRegistry({ description: e.target.value })}
        />
      </Field>

      {/*
        The category root prefixes every entry's category, so `software` here makes an
        entry's `consulting` read `software.consulting` (spec §4). It is a registry
        basic, not a field def — an owner sets it once and every listing inherits it. Said
        in the `hint` rather than only in this comment, because it is the owner who needs
        to know it and they cannot read the source.
      */}
      <Field label="Category root" hint="Prefixes every listing's category — “software” makes a listing's “consulting” read “software.consulting”.">
        <Input
          value={draft.registry.categoryRoot}
          onChange={(e) => editor.setRegistry({ categoryRoot: e.target.value })}
        />
      </Field>

      {/*
        The registry-level twin of an entry's keywords, and the same control, because it is
        the same kind of answer: labels somebody looking for a registry would type. No
        vocabulary to suggest from — registry tags are nobody's shared list yet — which leaves
        the chooser's create row as the way one is minted, exactly as in EntryReachPanel.
      */}
      <TagSetField
        label="Tags"
        noun="tag"
        hint="What someone would type to find this registry."
        options={[]}
        value={draft.registry.tags}
        onChange={(next) => editor.setRegistry({ tags: next })}
      />

      <Field label="What one listing is called" hint="Singular, lowercase — “coach”, “developer”, “consultant”.">
        <Input
          value={draft.registry.entryTerm}
          onChange={(e) => editor.setRegistry({ entryTerm: e.target.value })}
        />
      </Field>

      {/*
        The shared `Label` rather than `Field`: a boolean's caption trails its box, and
        `Field` puts every caption above (or in a fixed right-aligned column) — which is
        right for a captioned control and wrong for a checkbox. This is the shape the rest
        of the platform already uses for one (`ConnectionSpecFields`, `ProviderTemplateDialog`),
        and it keeps the old markup's caption-after-input order.
      */}
      <Label className="font-normal">
        <Checkbox
          checked={draft.registry.servicesEnabled}
          onCheckedChange={(checked) => editor.setRegistry({ servicesEnabled: checked === true })}
        />
        Listings can offer priced services
      </Label>

      {/*
        The shared danger zone, not a bespoke button: collapsed by default, and behind the
        two-phase confirm every other entity on the platform is deleted through. The typed
        confirmation is the SLUG rather than the name — a name is a label the owner can change
        and can hold duplicates across their registries, whereas the slug is the one string
        that identifies exactly this registry.
      */}
      <DeleteEntitySection
        entityNoun="Registry"
        confirmValue={draft.registry.slug}
        childEntities="its signup form, every listing people have submitted to it, and the address it answers on"
        onConfirm={async () => {
          await editor.deleteRegistry();
          onDeleted();
        }}
      />
    </FieldGroup>
  );
}
