// @vitest-environment jsdom
//
// Component test for PersonaEditor's facet framing (phase 3B / task 3.4). Asserts the reframed
// section set — Identity, Description, Personality (Character + Voice + Examples), Purpose (the
// relabelled prompt), Knowledge, Memory, Abilities, Permissions, LLM Settings — and that the two
// new persona-scoped panels plus the Knowledge / Memory surfaces receive the persona's id /
// ecosystem. The heavy leaf panels are mocked to their prop-echoing stubs so the test exercises the
// editor's wiring (which facet renders what, with which scope), not the panels' own behavior
// (covered by AbilitiesPanel.test / PermissionsPanel.test). A subtab is selected by driving the
// editor's URL-selection props (activeSubtab + onSubtabChange), the same seam PersonasSection uses.
//
// Knowledge/Chat cross package boundaries this feature can't reach directly, so the editor takes
// them as injected props (`renderKnowledgeBases`/`renderChatPane`) rather than importing
// KnowledgeBasesPane/PersonaChatPane itself — the render helpers below pass prop-echoing stubs for
// both instead of module-mocking them.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

// Prop-echoing stubs for the leaf panels: each renders a testid + the scoping prop it was handed,
// so the editor's "renders panel X with persona.id / ecosystem" wiring is directly assertable.
vi.mock("./AbilitiesPanel", () => ({
  AbilitiesPanel: ({ personaId }: { personaId: string }) => (
    <div data-testid="abilities" data-persona-id={personaId} />
  ),
}));
vi.mock("./PermissionsPanel", () => ({
  PermissionsPanel: ({ personaId }: { personaId: string }) => (
    <div data-testid="permissions" data-persona-id={personaId} />
  ),
}));
vi.mock("./PersonaAvatarField", () => ({ PersonaAvatarField: () => <div data-testid="avatar" /> }));
// InterestsEditor makes a real, unmocked `specialInterestsApi.list()` call on mount otherwise —
// stub it like every other leaf panel so this file stays isolated from that package's behavior
// (covered by InterestsEditor.test.tsx) and its `personaId` wiring is directly assertable.
vi.mock("./InterestsEditor", () => ({
  InterestsEditor: ({ personaId }: { personaId: string | null }) => (
    <div data-testid="interests" data-persona-id={personaId ?? ""} />
  ),
}));
// The Memory facet renders a CrudDataView over persona-memory/memories; stub the crud module so the
// stub echoes the meta/filter/scope the editor passes (and MEMORIES_TABLE resolves at module load).
vi.mock("@agentic-toolkit/crud", () => ({
  CRUD_TABLES: { "persona-memory/memories": { key: "persona-memory/memories", table: "memories" } },
  CrudDataView: (props: {
    meta: { key: string };
    filter?: Record<string, string>;
    scopeEcosystemId?: string;
  }) => (
    <div
      data-testid="memory-crud"
      data-table={props.meta.key}
      data-persona-id={props.filter?.personaId}
      data-eco={props.scopeEcosystemId}
    />
  ),
  useExitGuardChannel: () => ({ exitGuard: null, registerGuard: vi.fn() }),
}));
// Only api.personas.{update,create} need to be test doubles (the save-round-trip tests below drive
// them); everything else — including the real toPersonaDraft, which PersonaEditor calls to seed its
// draft on every render — passes through via importActual so the rest of this file's tests (which
// never touch the network) are unaffected.
vi.mock("@agentic-toolkit/data/personas", async () => {
  const actual = await vi.importActual<typeof import("@agentic-toolkit/data/personas")>(
    "@agentic-toolkit/data/personas",
  );
  return {
    ...actual,
    api: {
      ...actual.api,
      personas: { ...actual.api.personas, update: vi.fn(), create: vi.fn() },
    },
  };
});

import { PersonaEditor, saveBlockedReason } from "./PersonaEditor";
import { RailHostBoundary } from "@agentic-toolkit/resource";
import {
  api,
  type Persona,
  type PersonaDraft,
  type UserService,
} from "@agentic-toolkit/data/personas";

const updatePersona = vi.mocked(api.personas.update);

const PERSONA = {
  id: "persona-1",
  ownedEcosystemId: "owned-eco-9",
  slug: "bob",
  name: "Bob",
  description: "A helpful persona.",
  modelPrompt: "You are Bob.",
  voice: "Calm and precise.",
  character: "Wise and patient.",
  examples: "Q: hi\nA: hello",
  avatarAttachmentId: null,
  serviceId: null,
  serviceName: null,
  model: null,
  visibility: "private",
} as unknown as Persona;

// Prop-echoing stubs for the two injected cross-boundary renderers, passed to every render helper
// below so their seams are exercised the same way the mocked leaf panels' imports used to be.
const renderKnowledgeBases = (scopeEcosystemId: string) => (
  <div data-testid="knowledge" data-eco={scopeEcosystemId} />
);
const renderChatPane = () => <div data-testid="chat" />;

/** Render the editor with a saved persona, selecting `subtab` through the URL-selection seam
 *  (passing onSubtabChange makes the sub-tab URL-driven, so `activeSubtab` picks the facet).
 *  `persona` defaults to the shared fixture but can be overridden (e.g. a blank-prompt variant
 *  for the Save-gate tests below). `options` forwards testing-library's render options — the
 *  rail-host contract tests below use its `wrapper` to mount the editor under a rail host
 *  (default: no host, as the facet tests above assume). */
function renderEditor(
  subtab?: string,
  persona: Persona = PERSONA,
  options?: Parameters<typeof render>[1],
) {
  return render(
    <PersonaEditor
      persona={persona}
      services={[]}
      onSaved={vi.fn()}
      onCancel={vi.fn()}
      activeSubtab={subtab}
      onSubtabChange={vi.fn()}
      renderKnowledgeBases={renderKnowledgeBases}
      renderChatPane={renderChatPane}
    />,
    options,
  );
}

// No global afterEach in this package's vitest config, so tear each render down explicitly.
afterEach(cleanup);

describe("PersonaEditor facet framing", () => {
  it("opens with NO facet selected — selecting an item never auto-selects a topic", () => {
    renderEditor();
    // Spec: nothing opens until the user picks a topic — no Identity form, no leaf panel.
    expect(screen.queryByPlaceholderText("Bob")).toBeNull();
    expect(screen.queryByTestId("abilities")).toBeNull();
    expect(screen.queryByTestId("permissions")).toBeNull();
    expect(screen.getByText("Select a topic.")).not.toBeNull();
  });

  it("shows the Identity section when explicitly selected", () => {
    renderEditor("identity");
    expect(screen.getByPlaceholderText("Bob")).not.toBeNull();
    expect(screen.queryByTestId("abilities")).toBeNull();
  });

  it("Personality groups Character, Voice and Examples", () => {
    renderEditor("personality");
    expect(screen.getByText("Character")).not.toBeNull();
    expect(screen.getByText("Voice")).not.toBeNull();
    expect(screen.getByText("Examples")).not.toBeNull();
    // Seeded from the persona's fields — proving these ARE the existing Character/Voice/Examples.
    expect(screen.getByDisplayValue("Wise and patient.")).not.toBeNull();
    expect(screen.getByDisplayValue("Calm and precise.")).not.toBeNull();
    // Interests sit below the three draft fields, in the same facet — this is the one panel prop
    // that previously had no assertion at all.
    expect(screen.getByTestId("interests").getAttribute("data-persona-id")).toBe("persona-1");
  });

  it("Purpose is the relabelled prompt, still bound to modelPrompt", () => {
    renderEditor("purpose");
    expect(screen.getByText("Purpose")).not.toBeNull();
    expect(screen.getByDisplayValue("You are Bob.")).not.toBeNull();
  });

  it("Knowledge embeds the injected renderKnowledgeBases scoped to the persona's OWNED ecosystem, not its scoping ecosystem", () => {
    renderEditor("knowledge");
    expect(screen.getByTestId("knowledge").getAttribute("data-eco")).toBe("owned-eco-9");
  });

  it("Memory surfaces the persona-memory/memories table filtered to this persona and its OWNED ecosystem", () => {
    renderEditor("memory");
    const view = screen.getByTestId("memory-crud");
    expect(view.getAttribute("data-table")).toBe("persona-memory/memories");
    expect(view.getAttribute("data-persona-id")).toBe("persona-1");
    expect(view.getAttribute("data-eco")).toBe("owned-eco-9");
  });

  it("Abilities renders AbilitiesPanel with persona.id", () => {
    renderEditor("abilities");
    expect(screen.getByTestId("abilities").getAttribute("data-persona-id")).toBe("persona-1");
  });

  it("Permissions renders PermissionsPanel with persona.id", () => {
    renderEditor("permissions");
    expect(screen.getByTestId("permissions").getAttribute("data-persona-id")).toBe("persona-1");
  });

  it("keeps LLM Settings with its live chat", () => {
    renderEditor("llm");
    expect(screen.getByText("Service")).not.toBeNull();
    expect(screen.getByTestId("chat")).not.toBeNull();
  });
});

// The rail-host contract. PersonaEditor publishes its facet topics through StackGroupDetail and
// renders only the LEAF, so a host that mounts the editor DIRECTLY (rather than through
// PersonasSection/PersonasFeature, which self-host) MUST wrap it in RailHostBoundary — the persona
// registry does exactly that. Lose the wrapper and the failure is silent: the editor still renders,
// saves and typechecks, but no facet tab (Identity … Demo Chat) is reachable. The second test is
// the CONTROL — without it the first would still pass if RailHostBoundary were a no-op.
//
// The discriminator is the RAIL, not the hint: "Select a topic." is the leaf placeholder shown
// until a facet is chosen, so it is present in BOTH cases (a host's frontier nudge only replaces
// it inside the hub frame). What the wrapper decides is whether the facets are REACHABLE at all.
describe("PersonaEditor rail-host contract", () => {
  it("shows its facet topics when a host supplies a rail", () => {
    renderEditor(undefined, PERSONA, { wrapper: RailHostBoundary });
    // Every facet becomes a clickable rail topic — Demo Chat (this branch's facet) among them.
    expect(screen.getByRole("button", { name: "Demo Chat" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Identity" })).not.toBeNull();
  });

  it("falls back to the topic hint with no rail host", () => {
    renderEditor();
    // Published to nobody: not one facet is rendered, so no tab can be clicked…
    expect(screen.queryByText("Demo Chat")).toBeNull();
    expect(screen.queryByText("Identity")).toBeNull();
    // …and the editor sits on the leaf placeholder forever.
    expect(screen.getByText("Select a topic.")).not.toBeNull();
  });
});

describe("PersonaEditor facet gating for an unsaved draft", () => {
  /** A new-draft editor (persona === null); a subtab is still selectable via the URL seam. */
  function renderDraft(subtab: string) {
    return render(
      <PersonaEditor
        persona={null}
        services={[]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        activeSubtab={subtab}
        onSubtabChange={vi.fn()}
        renderKnowledgeBases={renderKnowledgeBases}
        renderChatPane={renderChatPane}
      />,
    );
  }

  it("gates Abilities behind the first save (no panel, a save-first notice instead)", () => {
    renderDraft("abilities");
    expect(screen.queryByTestId("abilities")).toBeNull();
    expect(screen.getByText(/Save this persona first to grant it tools/i)).not.toBeNull();
  });

  it("gates Knowledge and Memory behind the first save", () => {
    renderDraft("knowledge");
    expect(screen.queryByTestId("knowledge")).toBeNull();
    expect(screen.getByText(/Save this persona first to manage its knowledge bases/i)).not.toBeNull();
    cleanup();
    renderDraft("memory");
    expect(screen.queryByTestId("memory-crud")).toBeNull();
    expect(screen.getByText(/Save this persona first to view its memory/i)).not.toBeNull();
  });
});

describe("PersonaEditor facet gating when ownedEcosystemId is null (#5 null-guard)", () => {
  // A saved persona whose owned ecosystem hasn't been provisioned yet — MUST show a distinct
  // "not available" notice, and MUST NEVER fall back to the persona's scoping `ecosystemId`.
  const UNPROVISIONED = { ...PERSONA, ownedEcosystemId: null } as unknown as Persona;

  function renderUnprovisioned(subtab: string) {
    return render(
      <PersonaEditor
        persona={UNPROVISIONED}
        services={[]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        activeSubtab={subtab}
        onSubtabChange={vi.fn()}
        renderKnowledgeBases={renderKnowledgeBases}
        renderChatPane={renderChatPane}
      />,
    );
  }

  it("Knowledge shows a not-available notice instead of renderKnowledgeBases", () => {
    renderUnprovisioned("knowledge");
    expect(screen.queryByTestId("knowledge")).toBeNull();
    expect(screen.getByText(/knowledge bases aren't available yet/i)).not.toBeNull();
  });

  it("Memory shows a not-available notice instead of the memory CrudDataView", () => {
    renderUnprovisioned("memory");
    expect(screen.queryByTestId("memory-crud")).toBeNull();
    expect(screen.getByText(/memory isn't available yet/i)).not.toBeNull();
  });
});

// The LLM facet's Model row is a plain <Select> of model names. A host that can show more — each
// model's context window, pricing, modalities, plus a live re-fetch from the provider — injects it
// through `renderModelDetails`, the same cross-boundary seam `renderChatPane` uses. The registry
// wires its ServiceDetailsDialog there; the hub wires nothing, so the omitted case is a real
// shipping configuration and not just a control.
describe("PersonaEditor model details seam", () => {
  const SERVICE = {
    id: "svc-1",
    name: "Anthropic",
    models: [
      { id: "claude-opus-5", displayName: "Claude Opus 5" },
      { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
    ],
  } as unknown as UserService;
  const CONFIGURED = {
    ...PERSONA,
    serviceId: "svc-1",
    model: "claude-haiku-4-5",
  } as unknown as Persona;

  type RenderModelDetails = ComponentProps<typeof PersonaEditor>["renderModelDetails"];

  function renderLlm(persona: Persona, renderModelDetails?: RenderModelDetails) {
    return render(
      <PersonaEditor
        persona={persona}
        services={[SERVICE]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        activeSubtab="llm"
        onSubtabChange={vi.fn()}
        renderKnowledgeBases={renderKnowledgeBases}
        renderChatPane={renderChatPane}
        renderModelDetails={renderModelDetails}
      />,
    );
  }

  /** Echoes what the editor handed the host, and picks the OTHER model when clicked. */
  const detailsStub: RenderModelDetails = ({ service, selectedModelId, onSelect }) => (
    <button
      type="button"
      data-testid="model-details"
      data-service={service.id}
      data-selected={selectedModelId ?? ""}
      onClick={() => onSelect("claude-opus-5")}
    >
      Details
    </button>
  );

  it("hands the host the active service and the draft's model, and takes back the host's pick", () => {
    renderLlm(CONFIGURED, detailsStub);
    const button = screen.getByTestId("model-details");
    expect(button.getAttribute("data-service")).toBe("svc-1");
    expect(button.getAttribute("data-selected")).toBe("claude-haiku-4-5");
    // Same draft field as the Select beside it, so the Select re-renders on the host's pick —
    // this is what proves the seam WRITES rather than just reporting.
    expect((screen.getByDisplayValue("Claude Haiku 4.5") as HTMLSelectElement).value).toBe(
      "claude-haiku-4-5",
    );
    fireEvent.click(button);
    expect((screen.getByDisplayValue("Claude Opus 5") as HTMLSelectElement).value).toBe(
      "claude-opus-5",
    );
  });

  it("leaves the plain Select working when the host wires nothing — the hub's mount", () => {
    renderLlm(CONFIGURED, undefined);
    expect(screen.queryByTestId("model-details")).toBeNull();
    const select = screen.getByDisplayValue("Claude Haiku 4.5") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "claude-opus-5" } });
    expect((screen.getByDisplayValue("Claude Opus 5") as HTMLSelectElement).value).toBe(
      "claude-opus-5",
    );
  });

  it("isn't rendered at all until a service is chosen — there are no models to browse yet", () => {
    // PERSONA has serviceId: null, so the Model select reads "Pick a service first".
    renderLlm(PERSONA, detailsStub);
    expect(screen.queryByTestId("model-details")).toBeNull();
    expect(screen.getByDisplayValue("Pick a service first")).not.toBeNull();
  });
});

// Item access is a WORKSPACE concept: the panel needs a workspace to resolve roles and subjects
// against. The persona registry mounts this editor with no workspace at all, where the topic used
// to be listed and then say "Open this persona from a workspace…" — a tab that can never do
// anything in that host. Absent beats present-and-inert; inside a workspace it is listed as
// before (gated behind the first save like its neighbours).
describe("PersonaEditor Access topic is workspace-only", () => {
  function renderIn(workspaceSlug?: string) {
    return render(
      <PersonaEditor
        persona={PERSONA}
        services={[]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        workspaceSlug={workspaceSlug}
        onSubtabChange={vi.fn()}
        renderKnowledgeBases={renderKnowledgeBases}
        renderChatPane={renderChatPane}
      />,
      // A rail host, so the topics are actually published as clickable tabs (see the
      // rail-host contract above) — otherwise neither case would show any topic.
      { wrapper: RailHostBoundary },
    );
  }

  it("lists Access when the editor is mounted inside a workspace", () => {
    renderIn("acme");
    expect(screen.getByRole("button", { name: "Access" })).not.toBeNull();
  });

  it("omits Access entirely with no workspace — the registry mount", () => {
    renderIn(undefined);
    expect(screen.queryByRole("button", { name: "Access" })).toBeNull();
    // The neighbouring topics are unaffected — this hides ONE topic, not the rail.
    expect(screen.getByRole("button", { name: "Permissions" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Demo Chat" })).not.toBeNull();
  });
});

// The Save gate: `saveBlockedReason` is the located REASON Save is disabled (a bug report the old
// boolean `valid` couldn't give — see PersonaEditor.tsx's doc comment on the function). These unit
// tests prove the helper directly; the render tests below prove it (plus `dirty`) actually drives
// the button.
describe("saveBlockedReason", () => {
  // Every field a real PersonaDraft has — `examples` is `string | null`, NOT an array.
  const base: PersonaDraft = {
    id: "persona.mike.scout",
    slug: "scout",
    name: "Scout",
    description: "",
    modelPrompt: "",
    voice: "",
    character: "",
    examples: null,
    avatarAttachmentId: null,
    serviceId: null,
    serviceName: null,
    model: null,
    visibility: "private",
  };

  it("does not block a blank prompt — quick-create allows one", () => {
    expect(saveBlockedReason(base)).toBeNull();
    expect(saveBlockedReason({ ...base, modelPrompt: "" })).toBeNull();
  });

  it("blocks a blank name and points at the topic holding it", () => {
    const block = saveBlockedReason({ ...base, name: "  " });
    expect(block?.message).toMatch(/name/i);
    expect(block?.topicId).toBe("identity");
  });

  it("blocks a blank slug", () => {
    expect(saveBlockedReason({ ...base, slug: "" })?.message).toMatch(/slug/i);
  });

  it("blocks an invalid slug and says why", () => {
    const block = saveBlockedReason({ ...base, slug: "Not Valid" });
    expect(block?.message).toMatch(/slug/i);
    expect(block?.topicId).toBe("identity");
  });
});

// The spec's behavioural acceptance criteria: `saveBlockedReason` alone doesn't prove the button
// reacts correctly — these prove Save is gated on `dirty && valid` together, rendered through the
// real StackGroupDetail/ButtonBar wiring (activeSubtab="identity" so the Identity pane — Name +
// Visibility — is actually on screen; a bare renderEditor() selects no topic at all).
describe("PersonaEditor Save gate", () => {
  it("a blank prompt does not stop an Identity edit from saving", async () => {
    // The reported bug: modelPrompt lives in Purpose, not Identity, so a blank prompt must never
    // hold Identity edits hostage.
    renderEditor("identity", { ...PERSONA, modelPrompt: "" } as unknown as Persona);
    const save = screen.getByRole("button", { name: /save/i });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/name/i), "!");
    expect(save).toBeEnabled();
  });

  it("changing visibility alone enables Save", async () => {
    renderEditor("identity");
    const save = screen.getByRole("button", { name: /save/i });
    expect(save).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText(/visibility/i), "public");
    expect(save).toBeEnabled();
  });

  it("reverting an edit disables Save again", async () => {
    renderEditor("identity");
    const save = screen.getByRole("button", { name: /save/i });
    const name = screen.getByLabelText(/name/i);
    await userEvent.type(name, "!");
    expect(save).toBeEnabled();
    await userEvent.type(name, "{backspace}");
    expect(save).toBeDisabled();
  });
});

// The located reason (SaveBlock) is useless if the UI never shows it — these prove the message
// actually reaches the screen (via ButtonBar's `leading` slot) and the offending topic gets marked,
// so a user editing Identity isn't left staring at a silently grey Save button (the reported bug).
// Rendered with activeSubtab="identity" so the Name field (and the Identity topic row) are on
// screen — a bare renderEditor() selects no topic at all (see the facet-framing describe above).
// Topics are plain <button data-htd-row> rows (topic-detail.tsx's itemButton), NOT role="tab" — so
// these assert against the real button + its accessible name (the visible label text) instead.
describe("PersonaEditor surfaces why Save is disabled", () => {
  it("says why Save is disabled once the user has edited", async () => {
    renderEditor("identity");
    await userEvent.clear(screen.getByLabelText(/name/i));
    expect(screen.getByText(/Enter a name in Identity/)).toBeInTheDocument();
  });

  // `renderEditor` alone renders ONLY the editor's own leaf content: without an ancestor rail
  // HOST, StackGroupDetail's StackLevels publisher no-ops (see resource/src/rail-host.tsx) and the
  // real topic rail (where `data-blocked` actually lands) never mounts at all. RailHostBoundary is
  // the same host-or-standalone boundary PersonasFeature wraps the editor in for real — here (no
  // ancestor host) it self-hosts via StandaloneRailHost, so the rail renders through the REAL
  // HierarchicalTopicDetail/topic-detail.tsx pipeline rather than a hand-rolled test stand-in.
  it("marks the topic holding the blocking field", async () => {
    render(
      <RailHostBoundary>
        <PersonaEditor
          persona={PERSONA}
          services={[]}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
          activeSubtab="identity"
          onSubtabChange={vi.fn()}
          renderKnowledgeBases={renderKnowledgeBases}
          renderChatPane={renderChatPane}
        />
      </RailHostBoundary>,
    );
    await userEvent.clear(screen.getByLabelText(/name/i));
    const identityTopic = screen.getByRole("button", { name: /identity/i });
    expect(identityTopic).toHaveAttribute("data-blocked", "true");
  });
});

// Cross-task fix-round-1 finding: save()'s success path (unlike ServicesSection's handleSave,
// which had the identical bug) previously never reset `saving`, and — unlike WorkItemEditor, whose
// real consumer unmounts it on save — PersonaEditor's real consumer (PersonasSection) does NOT
// clear the selected persona id on `onSaved`, so this editor instance stays mounted across a save.
// That makes the bug reachable in production: after any successful save the Save/Cancel bar would
// read "Saving…" and stay disabled forever, until the user navigated away and back. None of the
// "PersonaEditor Save gate" tests above click Save or await a real save round-trip — they only
// assert the DIRTY gate via typed edits — so this is the only test in the file that would catch a
// regression of the missing `finally { setSaving(false) }` fix.
describe("PersonaEditor save (edit mode)", () => {
  it("re-enables Save after a successful save (baseline moves AND saving clears)", async () => {
    const saved: Persona = { ...PERSONA, name: "Bobby" };
    updatePersona.mockResolvedValue(saved);

    renderEditor("identity");

    const save = screen.getByRole("button", { name: /save/i });
    await userEvent.clear(screen.getByLabelText(/name/i));
    await userEvent.type(screen.getByLabelText(/name/i), "Bobby");
    expect(save).toBeEnabled();

    await userEvent.click(save);
    await waitFor(() => expect(updatePersona).toHaveBeenCalledTimes(1));
    expect(updatePersona).toHaveBeenCalledWith(
      PERSONA.id,
      expect.objectContaining({ name: "Bobby" }),
      { workspace: undefined },
    );

    // Assert BOTH halves of post-save recovery, not just one: the button's accessible name is back
    // to "Save" (a stuck `saving` flag — no `finally { setSaving(false) }` on the success path —
    // would leave it reading "Saving…" forever, so this `findByRole` would time out) AND that
    // "Save" button is disabled (a skipped `commit()` — baseline never adopts the saved row — would
    // leave `dirty` true forever, so the button would be enabled instead). Either bug alone fails
    // this pair, mirroring the equivalent ServicesSection test.
    const saveAfter = await screen.findByRole("button", { name: "Save" });
    expect(saveAfter).toBeDisabled();
  });
});
