"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlignLeft,
  BookOpen,
  Brain,
  Drama,
  FolderKanban,
  IdCard,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Wrench,
} from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { CRUD_TABLES, CrudDataView, useExitGuardChannel } from "@agentic-toolkit/crud";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Field, FieldGroup, ButtonBar } from "@agentic-toolkit/ui/blocks";
import {
  StackGroupDetail,
  useRailExitGuard,
  useRecordAffordance,
  type GroupTopicItem,
} from "@agentic-toolkit/resource";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { Select } from "@agentic-toolkit/ui/components/select";
import { RdidEditor } from "@agentic-toolkit/ui/components/rdid-editor";
import { rdidPrefix, validateLeaf } from "@agentic-toolkit/ui/lib/rdid";
import { PersonaAvatarField } from "./PersonaAvatarField";
import { AbilitiesPanel } from "./AbilitiesPanel";
import { PermissionsPanel } from "./PermissionsPanel";
import { InterestsEditor } from "./InterestsEditor";
import { KnowledgeFacet } from "./InterestDocumentsPane";
import { DemoFacet } from "./DemoFacet";
import { ItemAccessPanel, workspaceSubjectsDirectory } from "@agentic-toolkit/teams";
import {
  api,
  personaBlank,
  personaToBody,
  toPersonaDraft,
  type Persona,
  type PersonaBody,
  type PersonaDraft,
  type PersonaVisibility,
  type UserService,
} from "@agentic-toolkit/data/personas";

/** A multi-field topic pane: padded + edge-to-edge (GroupTopicDetail renders
 *  panes with no inset, so the fields carry their own) and scrolls if tall. */
function TopicPane({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 px-6 py-4">{children}</div>;
}

/** A topic whose whole detail pane is one labelled textarea: it fills the pane
 *  and scrolls internally (one big field per topic reads better than a cramped
 *  fixed-height box). The label stays associated with the textarea via Field, so
 *  it keeps its accessible name. */
function FullPaneField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-6 py-4">
      <Field label={label} hint={hint} className="min-h-0 flex-1">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-0 flex-1 resize-none"
        />
      </Field>
    </div>
  );
}

/** A centered notice for a facet pane that either needs a saved persona (a draft has no id/owned
 *  ecosystem to scope its knowledge, memory, tools, or permissions to — mirrors the avatar/chat
 *  "save first" gates) or a saved persona whose owned ecosystem isn't provisioned yet, OR whose
 *  host hasn't wired the facet's injected renderer (embedded views that omit it). */
function SaveFirstNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center p-6 text-center">
      <p className="text-sm text-apt-text-muted">{children}</p>
    </div>
  );
}

/** One labelled, resizable textarea sized for grouping SEVERAL in a scrolling pane (the Personality
 *  facet stacks Character + Voice + Examples), as opposed to FullPaneField's single pane-filling
 *  field. */
function TallTextareaField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-32 resize-y"
      />
    </Field>
  );
}

// The persona's own memory rows live in persona-memory/memories (a personaId-keyed, generic-CRUD
// table). The Memory facet surfaces THIS persona's rows through the same CrudDataView the All-Data /
// Knowledge Bases browser uses — filtered to the persona and scoped to its ecosystem. (v1: this is
// the editable generic-CRUD editor, not a purpose-built read-only memory view — see phase-3b report.)
const MEMORIES_TABLE = CRUD_TABLES["persona-memory/memories"]!;

/** The Memory facet's pane: the persona's memory rows in a CrudDataView, filtered to this persona and
 *  scoped to the ecosystem it OWNS (not its scoping/home `ecosystemId` — when a persona acts as
 *  `self` it reads/writes memory under the ecosystem it owns), with its unsaved-work guard bridged
 *  into the host rail (exactly as IntegrationData does for a provider's synced-data table, via the
 *  same `useRailExitGuard` seam). A separate component so its hooks don't run inside the editor's
 *  topic-render closure. */
function PersonaMemoryPane({
  personaId,
  ownedEcosystemId,
}: {
  personaId: string;
  ownedEcosystemId: string;
}) {
  const { exitGuard, registerGuard } = useExitGuardChannel();
  useRailExitGuard(exitGuard);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-6 py-4">
      <CrudDataView
        meta={MEMORIES_TABLE}
        filter={{ personaId }}
        scopeEcosystemId={ownedEcosystemId}
        onGuardChange={registerGuard}
      />
    </div>
  );
}

const BLANK = personaBlank();

const VISIBILITIES: { id: PersonaVisibility; label: string }[] = [
  { id: "public", label: "Public — listed on the registry" },
  { id: "unlisted", label: "Unlisted — link only" },
  { id: "private", label: "Private — only you" },
];

/** Build the wire body from a draft (drop display-only joins; coerce blanks to undefined). */
const toBody = personaToBody;

/**
 * The persona editor — a topic/detail (one stack level) whose leaf carries a Save/Cancel bar over
 * the active section's fields, for both create (`persona === null`) and edit. The caller owns the
 * list; this pane owns the draft, validation, and save, then signals back.
 *
 * Several surfaces cross a package boundary the editor itself can't reach, so the HOST injects them:
 *  - `renderChatPane` — the live try-it chat (needs the host's own chat wiring);
 *  - `renderModelDetails` — the rich model browser beside the Model select (per-model metadata and
 *    a provider re-fetch, which read/write the host's service rows);
 *  - `profileUrlFor` — the persona's public profile URL (needs the host's site-URL config);
 *  - `renderKnowledgeBases` — the Knowledge Bases browser (a separate feature package this one
 *    doesn't depend on).
 * Each is optional, and omitting one degrades rather than breaks: the affordance is hidden (profile
 * URL, model details — the plain Select still picks a model) or replaced by a distinct "not
 * available in this view" notice (chat / knowledge bases) rather than the misleading "save first"
 * copy — the persona IS already saved, the view just doesn't wire it.
 */
export function PersonaEditor({
  persona,
  services,
  workspaceSlug,
  onSaved,
  onCancel,
  activeSubtab,
  onSubtabChange,
  renderChatPane,
  renderModelDetails,
  profileUrlFor,
  renderKnowledgeBases,
  renderProject,
}: {
  /** The persona to edit, or null to create a new one. */
  persona: Persona | null;
  /** The workspace whose principal will OWN a newly-created persona (threaded to create as
   *  `?workspace=` — see PersonasSection). Omit and the creator owns it. Saves of an existing
   *  persona are unaffected. */
  workspaceSlug?: string;
  /** The caller's services (for the service/model selects). */
  services: UserService[];
  onSaved: (saved: Persona) => void;
  onCancel: () => void;
  /** The active editor sub-tab from the URL (identity/description/…); undefined shows the first
   *  tab (Identity) with NO redirect. Meaningful only for a saved persona — a draft has no id to
   *  address, so the caller omits `onSubtabChange` while creating and sub-tabs select locally. */
  activeSubtab?: string;
  /** Route to a sub-tab (or null to clear back to the bare persona URL). When provided, the
   *  editor's sub-tab selection is URL-driven; omitted for a new draft (local selection). */
  onSubtabChange?: (subtab: string | null) => void;
  /** Renders the live try-it chat for a SAVED persona (the LLM Settings facet). Omit to show a
   *  "not available in this view" notice instead. */
  renderChatPane?: (persona: Persona) => ReactNode;
  /** Renders a richer model browser beside the Model select (the LLM Settings facet) — the one
   *  the plain `<Select>` of model names can't be: per-model context window, max output tokens,
   *  pricing, modalities and capability flags, plus a live re-fetch of the provider's model list.
   *  That view reads a service's provider metadata and writes back a refreshed service row, which
   *  is host-app territory, so it's injected the same way `renderChatPane` is. Called only when a
   *  service is selected; omit it and the facet is the bare Select. */
  renderModelDetails?: (args: {
    /** The currently selected service — the models being browsed belong to it. */
    service: UserService;
    selectedModelId: string | null;
    /** Writes the chosen model into the draft (null clears it). Does NOT save. */
    onSelect: (modelId: string | null) => void;
  }) => ReactNode;
  /** The persona's public profile URL for a given slug. Omit to hide the Public URL affordance
   *  entirely (it stays gated on `visibility === "public"` and a non-empty slug either way). */
  profileUrlFor?: (slug: string) => string;
  /** Renders the Knowledge Bases browser scoped to the persona's OWNED ecosystem (the Knowledge
   *  facet). Omit to show a "not available in this view" notice instead. */
  renderKnowledgeBases?: (scopeEcosystemId: string) => ReactNode;
  /** Renders the persona's auto-provisioned PROJECT (the Project facet — a separate feature
   *  package this one doesn't depend on, so the host injects the pane, e.g.
   *  @agentic-toolkit/projects' SubjectProjectPane). Omit to show a "not available in this
   *  view" notice instead. */
  renderProject?: (personaId: string) => ReactNode;
}) {
  // Derive the initial draft from the persona prop; keyed remount (per id) in the
  // parent gives each persona a fresh editor, so seeding state here is safe.
  const [draft, setDraft] = useState<PersonaDraft>(() =>
    persona ? toPersonaDraft(persona) : BLANK,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderRecordAffordance = useRecordAffordance();

  const set = <K extends keyof PersonaDraft>(key: K, value: PersonaDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const isNew = persona === null;
  const valid =
    draft.name.trim() !== "" &&
    draft.slug.trim() !== "" &&
    validateLeaf(draft.slug) === null &&
    draft.modelPrompt.trim() !== "";
  const idPrefix = rdidPrefix(persona?.id);

  const activeService = useMemo(
    () => services.find((s) => s.id === draft.serviceId) ?? null,
    [services, draft.serviceId],
  );
  // A service switch invalidates the model: clear it unless the new service still offers it.
  useEffect(() => {
    if (draft.model && activeService && !activeService.models.some((m) => m.id === draft.model)) {
      set("model", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.serviceId]);

  async function save() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const body = toBody(draft);
      // The workspace scope rides every write (workspaceQuery no-ops when absent):
      // update under an org workspace needs it so a member can save personas OTHER
      // members created for the org (the item ownership scope replaces the creator pin).
      const saved = isNew
        ? await api.personas.create(body, { workspace: workspaceSlug })
        : await api.personas.update(persona.id, body, { workspace: workspaceSlug });
      onSaved(saved);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "personas", step: "save" });
      setError(err instanceof Error ? err.message : "Failed to save persona.");
      setSaving(false);
    }
  }

  // The editor is a topic/detail published into the one merged stack, framing the persona as its
  // five facets — Personality (character + voice + examples), Purpose (its prompt), Knowledge, Memory,
  // Abilities — plus context-scoped Permissions, bracketed by the structural sections that don't map
  // to a facet: Identity + Description on top, LLM Settings (with its live chat) at the bottom. The
  // facet panes that act on a real persona (Knowledge / Memory / Abilities / Permissions) are gated
  // behind the first save. The Save/Cancel bar lives IN the leaf (above the active section).
  const topics: GroupTopicItem[] = [
    {
      id: "identity",
      label: "Identity",
      icon: <IdCard size={16} aria-hidden />,
      render: () => (
        <TopicPane>
          <FieldGroup title="Identity">
            <Field label="Name">
              <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Bob" />
            </Field>
            <RdidEditor
              label="Slug"
              prefix={idPrefix}
              value={draft.slug}
              placeholder="bob"
              hint={
                idPrefix
                  ? "Only the name is editable — the inherited scope is fixed. The persona's public URL."
                  : "URL-safe id (lowercase, digits, hyphens). The persona's public URL."
              }
              error={draft.slug ? validateLeaf(draft.slug) : undefined}
              onChange={(leaf) => set("slug", leaf)}
            />
            <Field label="Avatar" hint="Shown on the persona's public profile.">
              {isNew ? (
                // The upload owns the attachment by persona id (ownerType='persona',
                // ownerId=persona.id), and the public avatar read is scoped to that —
                // so an avatar can only be attached once the persona has a real id.
                // A draft has none, so gate it behind the first save (like chat).
                <p className="text-sm text-apt-text-muted">
                  Save this persona first to add an avatar.
                </p>
              ) : (
                <PersonaAvatarField
                  personaId={persona.id}
                  value={draft.avatarAttachmentId}
                  onChange={(id) => set("avatarAttachmentId", id)}
                />
              )}
            </Field>
            <Field label="Visibility">
              <Select
                value={draft.visibility}
                onChange={(e) => set("visibility", e.target.value as PersonaVisibility)}
              >
                {VISIBILITIES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </Field>
            {/* Public personas have a live profile page; surface the full URL so
                the owner can open/share it. Opens in a new tab. Hidden entirely
                when the host doesn't inject a profile-URL resolver. */}
            {profileUrlFor && draft.visibility === "public" && draft.slug.trim() !== "" && (
              <div className="flex flex-col items-start gap-1.5">
                <span className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
                  Public URL
                </span>
                <a
                  href={profileUrlFor(draft.slug.trim())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-sm text-apt-gold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-apt-gold/40"
                >
                  {profileUrlFor(draft.slug.trim())}
                </a>
              </div>
            )}
          </FieldGroup>
        </TopicPane>
      ),
    },
    {
      id: "description",
      label: "Description",
      icon: <AlignLeft size={16} aria-hidden />,
      render: () => (
        <FullPaneField
          label="Description"
          value={draft.description ?? ""}
          onChange={(v) => set("description", v || null)}
          placeholder="A one-line summary of this persona."
        />
      ),
    },
    {
      id: "personality",
      label: "Personality",
      icon: <Drama size={16} aria-hidden />,
      // Facet 1 — how the persona expresses itself: its Character (who it is) and Voice (how it
      // speaks), grouped with the few-shot Examples that demonstrate both. Three fields in one
      // scrolling pane, so the whole personality reads as a single facet.
      render: () => (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          <TallTextareaField
            label="Character"
            hint="Personality, quirks, values."
            value={draft.character ?? ""}
            onChange={(v) => set("character", v || null)}
            placeholder="Personality, quirks, values."
          />
          <TallTextareaField
            label="Voice"
            hint="How the persona speaks."
            value={draft.voice ?? ""}
            onChange={(v) => set("voice", v || null)}
            placeholder="How the persona speaks."
          />
          <TallTextareaField
            label="Examples"
            hint="Example exchanges (few-shot) that demonstrate its character and voice."
            value={draft.examples ?? ""}
            onChange={(v) => set("examples", v || null)}
            placeholder="Example exchanges."
          />
          {/* Interests are a CHILD table with their own save, so they sit below the three draft
              fields rather than joining them — same facet (this is where an author writes the
              persona's personality), different lifecycle. `persona` is null for an unsaved draft. */}
          <InterestsEditor personaId={persona?.id ?? null} />
        </div>
      ),
    },
    {
      id: "purpose",
      label: "Purpose",
      icon: <Target size={16} aria-hidden />,
      // Facet 2 — the persona's purpose IS its `modelPrompt`: the system prompt that defines what it
      // is for (required). Alongside the editor, an "API" button opens a live, authed try-it panel for
      // GET /persona/personas/{id} (id prefilled), only once the persona exists.
      render: () => (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {persona && (
            <div className="px-6 pt-4">
              <span className="text-xs text-apt-text-muted">
                Stored as the <code className="font-mono">modelPrompt</code> field on this persona.
              </span>
            </div>
          )}
          <FullPaneField
            label="Purpose"
            hint="The system prompt that defines what this persona is for — required."
            value={draft.modelPrompt}
            onChange={(v) => set("modelPrompt", v)}
            placeholder="You are Bob, an expert at naming dogs…"
          />
        </div>
      ),
    },
    {
      id: "project",
      label: "Project",
      icon: <FolderKanban size={16} aria-hidden />,
      description: "The persona's own project — plan and track its work.",
      // The persona's auto-provisioned PROJECT (subject-linked at create / by the deploy
      // backfill). The projects feature package is a sibling this package doesn't depend
      // on, so its pane is host-injected (renderProject) — same seam as Knowledge above.
      render: () => {
        if (!persona) {
          return <SaveFirstNotice>Save this persona first to open its project.</SaveFirstNotice>;
        }
        if (!renderProject) {
          return <SaveFirstNotice>The project isn't available in this view.</SaveFirstNotice>;
        }
        return renderProject(persona.id);
      },
    },
    {
      id: "knowledge",
      label: "Knowledge",
      icon: <BookOpen size={16} aria-hidden />,
      // Facet 3 — the persona's knowledge: the Knowledge Bases surface (host-injected, scoped to
      // the ecosystem this persona OWNS) plus one tab per special interest, whose research corpus
      // lives in the OWNER's realm (`corpusEcosystemId`) instead. Two different ecosystems, which
      // is why they are sibling tabs rather than one merged pane. A draft has no id, so gate the
      // whole facet behind the first save; the per-pane "not provisioned yet" cases are handled
      // inside KnowledgeFacet.
      render: () => {
        if (!persona) {
          return <SaveFirstNotice>Save this persona first to manage its knowledge bases.</SaveFirstNotice>;
        }
        return <KnowledgeFacet persona={persona} renderKnowledgeBases={renderKnowledgeBases} />;
      },
    },
    {
      id: "memory",
      label: "Memory",
      icon: <Brain size={16} aria-hidden />,
      // Facet 4 — this persona's own memory rows (persona-memory/memories), filtered to it and scoped
      // to the ecosystem it OWNS (see PersonaMemoryPane's doc comment). Gated behind the first save
      // (a draft has no id), and again behind the owned ecosystem existing (see Knowledge above).
      render: () => {
        if (!persona) {
          return <SaveFirstNotice>Save this persona first to view its memory.</SaveFirstNotice>;
        }
        if (!persona.ownedEcosystemId) {
          return <SaveFirstNotice>This persona's memory isn't available yet.</SaveFirstNotice>;
        }
        return <PersonaMemoryPane personaId={persona.id} ownedEcosystemId={persona.ownedEcosystemId} />;
      },
    },
    {
      id: "abilities",
      label: "Abilities",
      icon: <Wrench size={16} aria-hidden />,
      // Facet 5 — what tools this persona HAS: grant/revoke + per-tool autonomy, against its real id.
      // Gated behind the first save.
      render: () =>
        persona ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <AbilitiesPanel personaId={persona.id} />
          </div>
        ) : (
          <SaveFirstNotice>Save this persona first to grant it tools.</SaveFirstNotice>
        ),
    },
    {
      id: "permissions",
      label: "Permissions",
      icon: <ShieldCheck size={16} aria-hidden />,
      // Context-scoped Permissions — WHERE / AS-WHAT this persona may act (its may_act grants) plus
      // its pending human-decision queue. Gated behind the first save.
      render: () =>
        persona ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <PermissionsPanel personaId={persona.id} />
          </div>
        ) : (
          <SaveFirstNotice>Save this persona first to configure its permissions.</SaveFirstNotice>
        ),
    },
    // WHO may reach this persona — the per-item share panel (restriction mode + item-scoped
    // role assignments + the effective-permission explainer; docs/workspace-roles-permissions.md).
    // Distinct from Permissions above, which is what the persona itself may DO.
    //
    // Item access is a WORKSPACE concept, so the topic is absent entirely outside one (the
    // registry mounts this editor with no workspaceSlug) rather than listed and then explaining
    // it can't work here: a topic that never has anything to show is noise, not degradation.
    // Inside a workspace it stays listed and gated behind the first save like its neighbours,
    // because there the answer really is "not yet".
    ...(workspaceSlug
      ? [
          {
            id: "access",
            label: "Access",
            icon: <KeyRound size={16} aria-hidden />,
            render: () =>
              persona ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                  <ItemAccessPanel
                    workspaceSlug={workspaceSlug}
                    feature="personas"
                    itemId={persona.id}
                    itemLabel={persona.name || persona.slug}
                    subjectsDirectory={workspaceSubjectsDirectory}
                  />
                </div>
              ) : (
                <SaveFirstNotice>Save this persona first to manage who can access it.</SaveFirstNotice>
              ),
          },
        ]
      : []),
    {
      id: "demo",
      label: "Demo Chat",
      icon: <MessageSquare size={16} aria-hidden />,
      description:
        "A scripted conversation anyone can hold with this persona — no LLM service required.",
      render: () => (
        <DemoFacet value={draft.cannedChat} onChange={(v) => set("cannedChat", v)} />
      ),
    },
    {
      id: "llm",
      label: "LLM Settings",
      icon: <SlidersHorizontal size={16} aria-hidden />,
      // A structural section (not a facet): the Settings card (service + model) on top, with a live
      // chat against that configuration below it — so you can pick a model and try it in one place.
      // The chat pane needs the host's own chat wiring (a package this one can't depend on), so it's
      // host-injected; a saved persona whose host omits it gets a distinct notice from the "save
      // first" copy shown to an unsaved draft.
      render: () => (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-6 py-4">
          <FieldGroup title="Settings">
            <Field label="Service" hint="The persona-service this persona runs on.">
              <Select
                value={draft.serviceId ?? ""}
                onChange={(e) => set("serviceId", e.target.value || null)}
              >
                <option value="">No service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Model">
              {/* Select grows, the injected details affordance keeps its natural width. The
                  sizing lives on this wrapper, not on Select's `className` — that lands on the
                  inner <select>, while the flex CHILD here is Select's own `relative` chevron
                  wrapper, which would stay content-sized. */}
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={draft.model ?? ""}
                    onChange={(e) => set("model", e.target.value || null)}
                    disabled={!activeService || activeService.models.length === 0}
                  >
                    <option value="">
                      {activeService ? "No model selected" : "Pick a service first"}
                    </option>
                    {activeService?.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName ?? m.id}
                      </option>
                    ))}
                  </Select>
                </div>
                {activeService &&
                  renderModelDetails?.({
                    service: activeService,
                    selectedModelId: draft.model ?? null,
                    onSelect: (modelId) => set("model", modelId),
                  })}
              </div>
            </Field>
          </FieldGroup>
          {persona ? (
            renderChatPane ? (
              renderChatPane(persona)
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center p-6 text-center">
                <p className="text-sm text-apt-text-muted">Chat isn't available in this view.</p>
              </div>
            )
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center p-6 text-center">
              <p className="text-sm text-apt-text-muted">Save this persona to start chatting with it.</p>
            </div>
          )}
        </div>
      ),
    },
  ];

  // The Save/Cancel bar sits at the top of the LEAF (the active section's pane), not in a bar above
  // the whole stack. Delete is intentionally absent here.
  const leafHeader = (
    <>
      <ButtonBar
        actions={{
          onCreate: () => {},
          onCancel,
          canCancel: true,
          onSave: () => void save(),
          canSave: valid,
          saving,
        }}
        showCreate={false}
        showDelete={false}
      />
      <ErrorText error={error} className="px-6 pt-2" />
      {/* The persona's API, on every facet: the item read once saved, the create POST while new. */}
      <div className="flex justify-end px-6 pt-2">
        {persona
          ? renderRecordAffordance?.({
              method: "GET",
              path: "/persona/personas/{id}",
              pathValues: { id: persona.id },
              title: "Persona API",
            })
          : renderRecordAffordance?.({
              method: "POST",
              path: "/persona/personas",
              pathValues: {},
              title: "Create persona API",
            })}
      </div>
    </>
  );

  return (
    <StackGroupDetail
      levelId="persona-topics"
      title={isNew ? "New persona" : draft.name || "Persona"}
      items={topics}
      leafHeader={leafHeader}
      // URL-drive the sub-tab only for a saved persona (a draft has no id to address, so it selects
      // sub-tabs in local state). With no sub-tab in the URL nothing opens — the bare
      // /<slug>/personas/<id> URL shows the topics unselected (never auto-select a topic).
      urlSelection={
        onSubtabChange
          ? { selectedId: activeSubtab ?? null, onSelect: onSubtabChange }
          : undefined
      }
    />
  );
}
