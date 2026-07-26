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
import { render, screen, cleanup } from "@testing-library/react";

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

import { PersonaEditor } from "./PersonaEditor";
import { RailHostBoundary } from "@agentic-toolkit/resource";
import type { Persona } from "@agentic-toolkit/data/personas";

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
 *  `options` forwards testing-library's render options — the rail-host contract tests below use
 *  its `wrapper` to mount the editor under a rail host (default: no host, as the facet tests
 *  above assume). */
function renderEditor(subtab?: string, options?: Parameters<typeof render>[1]) {
  return render(
    <PersonaEditor
      persona={PERSONA}
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
    renderEditor(undefined, { wrapper: RailHostBoundary });
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
