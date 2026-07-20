// @vitest-environment jsdom
//
// Component test for TeamMembersPane — the team roster. This package's vitest config is
// jsdom (see vitest.config.ts) and drives React with @testing-library/react. Only the
// data domain boundaries (@agentic-toolkit/data/teams, @agentic-toolkit/data/personas)
// are mocked, so the roster's kind-aware render + add-persona wiring are exercised, not
// the transport.
//
// The members LIST is published to a rail HOST via useStackLevel (not rendered by the
// pane itself), so a tiny <Rail> harness backed by the toolkit's RailHostContext renders
// the published level's rows + its "New member" rail affordance — the same path the
// hub's workspace shell uses (mirrors ProjectsFeature.test's Harness, extended here to
// also compose the registered exit guards the way the shell's WorkspaceChromeProvider
// does, since this pane is the one that publishes one via useRailExitGuard).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup, act } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
  type PaneExitGuard,
} from "@agentic-toolkit/resource";

vi.mock("@agentic-toolkit/data/teams", () => ({
  teamMembersApi: {
    list: vi.fn(),
    counts: vi.fn(),
    add: vi.fn(),
    addPersona: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("@agentic-toolkit/data/personas", () => ({
  api: { personas: { list: vi.fn() } },
}));

import { TeamMembersPane } from "./TeamMembersPane";
import { teamMembersApi, type TeamMember } from "@agentic-toolkit/data/teams";
import { api as personaApi, type Persona } from "@agentic-toolkit/data/personas";

const list = vi.mocked(teamMembersApi.list);
const add = vi.mocked(teamMembersApi.add);
const addPersona = vi.mocked(teamMembersApi.addPersona);
const personasList = vi.mocked(personaApi.personas.list);

const CUSTOMER: TeamMember = {
  id: "m1",
  teamId: "t1",
  userId: "u1",
  role: "member",
  addedAt: "2026-07-03T00:00:00Z",
  memberKind: "customer",
  email: "ada@example.com",
  displayName: "Ada",
  personaSlug: null,
  personaName: null,
};
const PERSONA_MEMBER: TeamMember = {
  id: "m2",
  teamId: "t1",
  userId: "u2",
  role: "member",
  addedAt: "2026-07-03T00:00:00Z",
  memberKind: "persona",
  email: null,
  displayName: null,
  personaSlug: "bit",
  personaName: "Bitbag",
};
const PERSONAS = [{ id: "p1", slug: "bit", name: "Bitbag" }] as unknown as Persona[];

// Captures the harness-composed exit guard so a test can assert it fires (and where its
// save routes) without driving the shell's Back/breadcrumb exit flow.
const guardRef: { current: PaneExitGuard | null } = { current: null };

beforeEach(() => {
  vi.clearAllMocks();
  guardRef.current = null;
  list.mockResolvedValue([]);
  personasList.mockResolvedValue(structuredClone(PERSONAS));
  addPersona.mockResolvedValue(structuredClone(PERSONA_MEMBER));
});

// This package's vitest config has no global afterEach, so RTL's auto-cleanup never
// registers — tear down each render explicitly to keep renders from bleeding across tests.
afterEach(cleanup);

/** Renders the published member level (rows + the "New member" rail affordance) the way
 *  the workspace shell would, so the test can see and drive the shell-owned roster list. */
function Rail({ levels }: { levels: TopicLevel[] }) {
  const level = levels[0];
  return (
    <div>
      {level?.onNew && (
        <button type="button" onClick={() => level.onNew?.()}>
          {level.newLabel}
        </button>
      )}
      <List>
        {levels
          .flatMap((l) => l.items)
          .map((it) => (
            <ListItem key={it.id}>
              {it.icon}
              <button type="button" onClick={() => level?.onSelect(it.id)}>
                {it.label}
              </button>
            </ListItem>
          ))}
      </List>
    </div>
  );
}

/** A minimal rail HOST: it registers ResourceExplorer/pane-published levels AND composes
 *  every registered exit guard, the way the hub's WorkspaceChromeProvider does — dirty
 *  when any publisher is dirty, its `save` persisting every dirty publisher. Stands in
 *  for the host so both the published "New member" rail affordance and the pane's exit
 *  guard are drivable/observable in the test. */
function Harness({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, RegisteredLevels>>(new Map());
  const [guards, setGuards] = useState<Map<string, PaneExitGuard>>(new Map());
  const registry: RailHostRegistry = useMemo(
    () => ({
      registerLevels: (id, entry) =>
        setEntries((m) => {
          const next = new Map(m);
          next.set(id, entry);
          return next;
        }),
      unregisterLevels: (id) =>
        setEntries((m) => {
          if (!m.has(id)) return m;
          const next = new Map(m);
          next.delete(id);
          return next;
        }),
      registerExitGuard: (id, guard) =>
        setGuards((m) => {
          if (guard === null && !m.has(id)) return m;
          const next = new Map(m);
          if (guard === null) next.delete(id);
          else next.set(id, guard);
          return next;
        }),
      toolbarSlot: null,
    }),
    [],
  );
  const mergedLevels = [...entries.values()]
    .sort((a, b) => a.depth - b.depth)
    .flatMap((e) => e.levels);
  guardRef.current =
    guards.size === 0
      ? null
      : {
          isDirty: () => [...guards.values()].some((g) => g.isDirty()),
          save: async () => {
            for (const g of guards.values()) if (!(await g.save())) return false;
            return true;
          },
        };
  return (
    <RailHostContext.Provider value={registry}>
      <Rail levels={mergedLevels} />
      {children}
    </RailHostContext.Provider>
  );
}

function TestHarness() {
  const [leafId, setLeafId] = useState<string | null>(null);
  return (
    <Harness>
      <TeamMembersPane teamId="t1" leaf={{ leafId, onSelect: (id) => setLeafId(id) }} />
    </Harness>
  );
}

describe("TeamMembersPane", () => {
  it("renders a customer member and a persona member distinctly", async () => {
    list.mockResolvedValue([structuredClone(CUSTOMER), structuredClone(PERSONA_MEMBER)]);
    render(<TestHarness />);

    // Customer: email label + person icon (never a bot).
    const custRow = (await screen.findByText("ada@example.com")).closest("li");
    expect(custRow?.querySelector(".lucide-user-round")).not.toBeNull();
    expect(custRow?.querySelector(".lucide-bot")).toBeNull();

    // Persona: labelled by its NAME (its email is null) + a Bot icon (never a person).
    const personaRow = screen.getByText("Bitbag").closest("li");
    expect(personaRow?.querySelector(".lucide-bot")).not.toBeNull();
    expect(personaRow?.querySelector(".lucide-user-round")).toBeNull();
  });

  it("shows a persona's identity distinctly in the member-detail leaf", async () => {
    list.mockResolvedValue([structuredClone(PERSONA_MEMBER)]);
    render(<TestHarness />);

    // Select the persona member from the published list; the pane renders its detail leaf.
    fireEvent.click(await screen.findByRole("button", { name: "Bitbag" }));

    // The detail marks it as a Persona and surfaces the slug — distinct from a customer card.
    expect(await screen.findByText(/Persona · bit/)).not.toBeNull();
    expect(screen.getByRole("button", { name: /remove from team/i })).not.toBeNull();
  });

  it("adds a picked persona and shows the new member on reload", async () => {
    // First load: only the customer. After the add, the reload returns the new persona member too.
    list.mockResolvedValueOnce([structuredClone(CUSTOMER)]);
    list.mockResolvedValue([structuredClone(CUSTOMER), structuredClone(PERSONA_MEMBER)]);
    render(<TestHarness />);

    await screen.findByText("ada@example.com");
    fireEvent.click(screen.getByRole("button", { name: "New member" }));

    // The add is a scoped create modal (`must-create-in-modal`): pick the persona, Save.
    const dialog = within(screen.getByRole("dialog", { name: "New member" }));
    fireEvent.change(await dialog.findByRole("combobox"), { target: { value: "p1" } });
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(addPersona).toHaveBeenCalledWith("t1", "p1"));
    // The reload surfaces the new persona member as a roster row.
    expect(await screen.findByRole("button", { name: "Bitbag" })).not.toBeNull();
  });

  it("surfaces the error when the add is rejected (persona lacks may_act 'team')", async () => {
    list.mockResolvedValue([structuredClone(CUSTOMER)]);
    addPersona.mockRejectedValueOnce(new Error("persona bit is not granted may_act 'team'"));
    render(<TestHarness />);

    await screen.findByText("ada@example.com");
    fireEvent.click(screen.getByRole("button", { name: "New member" }));
    const dialog = within(screen.getByRole("dialog", { name: "New member" }));
    fireEvent.change(await dialog.findByRole("combobox"), { target: { value: "p1" } });
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/not granted may_act 'team'/)).not.toBeNull();
    // The rejected add adds no roster row (the "Bitbag" in the still-open picker is an <option>,
    // not a member-row <button>).
    expect(screen.queryByRole("button", { name: "Bitbag" })).toBeNull();
  });

  it("guards against a double-submit of Add member — only one add fires while in flight", async () => {
    list.mockResolvedValue([]);
    let resolveAdd!: () => void;
    add.mockImplementation(
      () =>
        new Promise<TeamMember>((r) => {
          resolveAdd = () => r(structuredClone(CUSTOMER));
        }),
    );
    render(<TestHarness />);

    fireEvent.click(screen.getByRole("button", { name: "New member" }));
    const dialog = within(screen.getByRole("dialog", { name: "New member" }));
    const input = await dialog.findByPlaceholderText("name@example.com");
    fireEvent.change(input, { target: { value: "ada@example.com" } });

    // Hold the button element: while the add is in flight its label flips to "Saving…".
    const addBtn = dialog.getByRole("button", { name: "Save" });
    fireEvent.click(addBtn); // first submit → add(...) in flight, dialog saving
    // A second click (button now disabled) AND an Enter while the first add is still
    // in flight must not fire a second POST.
    fireEvent.click(addBtn);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(add).toHaveBeenCalledTimes(1);

    // Settle the in-flight add so the reload can complete without an unhandled rejection.
    list.mockResolvedValue([structuredClone(CUSTOMER)]);
    await act(async () => {
      resolveAdd();
    });
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  });

  it("clears a prior add error once a retried save succeeds", async () => {
    list.mockResolvedValue([]);
    add.mockRejectedValueOnce(new Error("no user with that email"));
    add.mockResolvedValueOnce(structuredClone(CUSTOMER));
    render(<TestHarness />);

    fireEvent.click(screen.getByRole("button", { name: "New member" }));
    const dialog = within(screen.getByRole("dialog", { name: "New member" }));
    const input = await dialog.findByPlaceholderText("name@example.com");
    fireEvent.change(input, { target: { value: "ada@example.com" } });

    const addBtn = dialog.getByRole("button", { name: "Save" });
    fireEvent.click(addBtn); // first attempt rejects
    expect(await screen.findByText("no user with that email")).not.toBeNull();

    // Retry with the same (still valid) draft — this time the add succeeds.
    list.mockResolvedValue([structuredClone(CUSTOMER)]);
    fireEvent.click(addBtn);

    await waitFor(() => expect(add).toHaveBeenCalledTimes(2));
    // The retry's success must clear the stale error from the first attempt.
    await waitFor(() => expect(screen.queryByText("no user with that email")).toBeNull());
  });

  it("a dirty modal guards its close, and the guard's Save routes to the add-persona action", async () => {
    // The create modal owns its unsaved-work protection (no pane-level exit guard): a picked
    // persona with no email typed is still a dirty draft, so closing prompts instead of
    // silently discarding it — and saving from the prompt routes to add-persona, not the
    // empty email path.
    list.mockResolvedValue([]);
    render(<TestHarness />);

    fireEvent.click(screen.getByRole("button", { name: "New member" }));
    const dialog = within(screen.getByRole("dialog", { name: "New member" }));
    fireEvent.change(await dialog.findByRole("combobox"), { target: { value: "p1" } });

    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    const confirm = within(await screen.findByRole("alertdialog", { name: "Unsaved changes" }));

    await act(async () => {
      fireEvent.click(confirm.getByRole("button", { name: "Save" }));
    });
    expect(addPersona).toHaveBeenCalledWith("t1", "p1");
  });
});
