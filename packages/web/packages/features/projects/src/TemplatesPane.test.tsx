// @vitest-environment jsdom
//
// Component test for TemplatesPane — the library of shapes a workspace stamps out.
//
// Only the api-client boundary is mocked, so the pane runs on the REAL master/detail substrate
// (published rail level, URL-driven selection, ButtonBar, delete confirm) and the real
// useResourceList. Four properties carry the weight, and each is a claim neither tsc nor a
// screenshot can check:
//
//   1. A template belongs to the WORKSPACE, not to the board it was reached through — the same
//      claim ProgramsPane makes, and for the same reason: a shape pinned to one board could only
//      ever rebuild that board. The read is asserted to carry the workspace and NOTHING else, so a
//      well-meaning `kind: "work_item"` added to narrow the list fails here rather than silently
//      halving the library.
//   2. Both kinds live in ONE rail, each row saying what it MAKES. Choosing the wrong kind is the
//      only mistake this list can cause, so the second line is the row's whole job.
//   3. The kind is FROZEN on a saved template and OPEN while creating. The backend refuses to
//      re-kind a stored row, so an editable control there would be an offer the server declines —
//      and the patch is asserted to carry no `kind` at all.
//   4. A board template's stored shape re-hydrates as its columns and its plan, and the plan is
//      UNDATED. Seeding a template's dates would hand you a plan already overdue.
//
// The module-scope useResourceList cache is keyed by workspace and OUTLIVES cleanup(), so every
// test below gets a fresh slug AND fresh template ids; the hook always refetches on mount, so a
// shared key would only affect a first paint, but the tests asserting on a different list are the
// ones that would suffer it.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/projects")>()),
  projectTemplatesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { TemplatesPane, templateSublabel } from "./TemplatesPane";
import { projectTemplatesApi, type Template } from "@agentic-toolkit/data/projects";
import { RailHostBoundary, type TopicLeaf } from "@agentic-toolkit/resource";

const list = vi.mocked(projectTemplatesApi.list);
const create = vi.mocked(projectTemplatesApi.create);
const update = vi.mocked(projectTemplatesApi.update);
const remove = vi.mocked(projectTemplatesApi.remove);

function template(over: Partial<Template>): Template {
  return {
    id: "t1",
    kind: "work_item",
    name: "Ship a release",
    description: "",
    body: { title: "Cut the release tag" },
    ownerKind: "customer",
    ownerId: "cust-1",
    createdBy: null,
    ecosystemId: "eco-1",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

/** A fresh workspace slug AND fresh template ids per test — see the cache note at the top. */
let n = 0;
let slug = "";
let CARD: Template;
let BOARD: Template;

beforeEach(() => {
  vi.clearAllMocks();
  n += 1;
  slug = `acme-${n}`;
  CARD = template({
    id: `t-${n}-1`,
    body: {
      title: "Cut the release tag",
      children: [{ title: "Tag it" }, { title: "Announce it" }],
    },
  });
  BOARD = template({
    id: `t-${n}-2`,
    kind: "project",
    name: "Delivery board",
    body: {
      description: "The usual delivery board.",
      color: "#FF6600",
      estimateScale: "points",
      statuses: [{ key: "in_review", label: "In review", category: "in_progress" }],
      milestones: [{ name: "Beta" }],
    },
  });
  list.mockResolvedValue([structuredClone(CARD), structuredClone(BOARD)]);
  create.mockImplementation((input) =>
    Promise.resolve(
      template({ ...input, id: "t-new", description: input.description ?? "" }),
    ),
  );
  update.mockImplementation((id, patch) =>
    Promise.resolve(template({ ...structuredClone(CARD), id, ...patch })),
  );
  remove.mockResolvedValue(undefined);
});

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

/** The pane's list is a published rail LEVEL, so the harness mounts a RailHostBoundary (with no
 *  host above it, that is the same standalone host a feature site gives the feature). A stateful
 *  leaf deep-links the open template the way ResourceExplorer's URL leaf would. */
function Harness({
  workspaceSlug,
  selected = null,
  onSelectSpy,
}: {
  workspaceSlug: string;
  selected?: string | null;
  onSelectSpy?: (id: string | null) => void;
}) {
  const [leafId, setLeafId] = useState<string | null>(selected);
  const leaf: TopicLeaf = {
    leafId,
    onSelect: (id) => {
      onSelectSpy?.(id);
      setLeafId(id);
    },
  };
  return (
    <RailHostBoundary>
      <TemplatesPane title="Templates" leaf={leaf} workspaceSlug={workspaceSlug} />
    </RailHostBoundary>
  );
}

describe("TemplatesPane", () => {
  it("publishes the WORKSPACE's templates as one rail level, each row saying what it MAKES", async () => {
    render(<Harness workspaceSlug={slug} />);

    const rail = await screen.findByRole("complementary", { name: "Topic list" });
    const card = await within(rail).findByRole("button", { name: /Ship a release/ });
    const board = within(rail).getByRole("button", { name: /Delivery board/ });

    // The two kinds share a list because they are one verb with two objects — so the row has to
    // say which object, or the picker's only mistake is the one it invites.
    expect(card.textContent).toContain("A card + 2 steps");
    expect(board.textContent).toContain("A board");

    // Pinned to the WORKSPACE and to nothing else. `toHaveBeenCalledWith` is exact, so a `kind`
    // filter added here — the tempting way to feed one picker — fails rather than quietly halving
    // the library this pane exists to show.
    expect(list).toHaveBeenCalledWith({ workspace: slug });
  });

  it("opens the selected card template in the editor, seeded from its stored body", async () => {
    render(<Harness workspaceSlug={slug} selected={CARD.id} />);

    expect(await screen.findByDisplayValue("Ship a release")).not.toBeNull();
    expect(screen.getByDisplayValue("Cut the release tag")).not.toBeNull();
    // The checklist is part of the shape, not a detail of it: a template that lost its steps on
    // the round trip through the form would save as a template that stopped writing them.
    expect(screen.getByDisplayValue("Tag it")).not.toBeNull();
    expect(screen.getByDisplayValue("Announce it")).not.toBeNull();
    expect(screen.getByText("Step 1")).not.toBeNull();
    expect(screen.getByText("Step 2")).not.toBeNull();
  });

  it("reads a board template's stored shape into its columns and its plan, UNDATED", async () => {
    render(<Harness workspaceSlug={slug} selected={BOARD.id} />);

    expect(await screen.findByDisplayValue("in_review")).not.toBeNull();
    expect(screen.getByDisplayValue("In review")).not.toBeNull();
    expect(screen.getByDisplayValue("#FF6600")).not.toBeNull();
    expect(screen.getByDisplayValue("Beta")).not.toBeNull();

    // A plan point's date is a fact about ONE delivery. The form says so rather than offering a
    // date field, because a template written in July and used in October would otherwise seed a
    // plan that is already late.
    expect(screen.getByText("Dates are set on the board, not here.")).not.toBeNull();
    expect(screen.queryByDisplayValue("2026-08-01")).toBeNull();
  });

  it("freezes what a saved template makes, and states it instead of offering it", async () => {
    render(<Harness workspaceSlug={slug} selected={CARD.id} />);

    // Stated as a sentence, not as a one-option Select: the backend refuses to re-kind a stored
    // template, so a control here would be an offer the server declines. `queryByLabelText` finds
    // form controls, so its absence IS the assertion that nothing editable carries this caption.
    expect(await screen.findByText("A card")).not.toBeNull();
    // Anchored, because a Field's accessible label is its caption PLUS its hint.
    expect(screen.queryByLabelText(/^Makes/)).toBeNull();
    expect(
      screen.getByText("Fixed once saved — what a template makes is its identity."),
    ).not.toBeNull();
  });

  it("saves an edit as a PATCH carrying the shape and no kind", async () => {
    render(<Harness workspaceSlug={slug} selected={CARD.id} />);

    fireEvent.change(await screen.findByDisplayValue("Ship a release"), {
      target: { value: "Ship a hotfix" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // No `kind`, per the freeze above — and the body travels WHOLE rather than as a merge, which
    // is the only reading under which a step can ever be deleted. Empty fields are omitted, not
    // sent as "": a stored `description: ""` re-hydrates as a description nobody wrote.
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(CARD.id, {
        name: "Ship a hotfix",
        description: "",
        body: {
          title: "Cut the release tag",
          children: [{ title: "Tag it" }, { title: "Announce it" }],
        },
      }),
    );
  });

  it("refuses a name another template OF THE SAME KIND already has in the workspace", async () => {
    list.mockResolvedValue([
      structuredClone(CARD),
      structuredClone(BOARD),
      template({ id: `t-${n}-3`, name: "Onboard a customer" }),
    ]);
    render(<Harness workspaceSlug={slug} selected={CARD.id} />);

    // Case-insensitively, which is stricter than the database's exact-match uniqueness: this can
    // only warn early, never permit something the server would refuse with a 409.
    const name = await screen.findByDisplayValue("Ship a release");
    fireEvent.change(name, { target: { value: "onboard a customer" } });
    expect(
      await screen.findByText(
        'A card template named "onboard a customer" already exists in this workspace.',
      ),
    ).not.toBeNull();

    // …and the OTHER kind is not a collision. A card template and a board template can never be
    // offered in the same picker, so sharing a name costs nobody anything — the backend's own rule,
    // restated here so the form does not invent a stricter one.
    fireEvent.change(name, { target: { value: "delivery board" } });
    await waitFor(() =>
      expect(screen.queryByText(/already exists in this workspace/)).toBeNull(),
    );
  });

  it("says what deleting a template does NOT touch", async () => {
    render(<Harness workspaceSlug={slug} selected={CARD.id} />);

    // Wait for the TEMPLATE, not for the button: the bar is on screen from the first paint with
    // Delete disabled, so a click issued before the list lands is dropped on a disabled control
    // and the confirm never opens. What makes Delete live is having a row to delete.
    await screen.findByDisplayValue("Ship a release");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    // The sentence that makes this delete safe. What a template made is ordinary rows that stopped
    // being related to it the moment they were written; without saying so, retiring a shape reads
    // like it might take the boards built from it.
    expect(
      await screen.findByText(
        'Delete "Ship a release"? Nothing it has already created is affected — only the template goes.',
      ),
    ).not.toBeNull();
  });

  it("creates through a MODAL, in the workspace the pane was opened for", async () => {
    const onSelectSpy = vi.fn();
    render(<Harness workspaceSlug={slug} onSelectSpy={onSelectSpy} />);

    // The level's own "+" affordance, not a button in the leaf: creating belongs to the LIST.
    await screen.findByRole("complementary", { name: "Topic list" });
    fireEvent.click(screen.getByRole("button", { name: "New template" }));

    const dialog = await screen.findByRole("dialog", { name: "New template" });
    // Here the kind IS a live choice — the one difference between this form and the inline editor.
    expect(within(dialog).getByLabelText(/^Makes/)).not.toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Hotfix" } });
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "Roll it back" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    // The workspace rides along because a template has to be created IN one; it is not inferred
    // from anything on screen, and the pane was never told a project id to infer it from.
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        {
          kind: "work_item",
          name: "Hotfix",
          description: "",
          body: { title: "Roll it back" },
        },
        { workspace: slug },
      ),
    );
    // The new template opens, which is what makes "New" a create-and-edit rather than a create.
    await waitFor(() => expect(onSelectSpy).toHaveBeenCalledWith("t-new"));
  });
});

// The rail row's second line. A pure fold, so it is tested directly rather than through four
// renders — what matters is that every shape has a reading, because this line is the only thing
// separating the two kinds in a list that deliberately mixes them.
describe("templateSublabel", () => {
  it("says a board template makes a board", () => {
    expect(templateSublabel(template({ kind: "project", body: {} }))).toBe("A board");
  });

  it("says a lone card is a card, with no checklist to count", () => {
    expect(templateSublabel(template({ body: { title: "T" } }))).toBe("A card");
  });

  it("counts the STEPS, not the cards — the parent is not one of them", () => {
    expect(templateSublabel(template({ body: { title: "T", children: [{ title: "a" }] } }))).toBe(
      "A card + 1 step",
    );
    expect(
      templateSublabel(
        template({ body: { title: "T", children: [{ title: "a" }, { title: "b" }] } }),
      ),
    ).toBe("A card + 2 steps");
  });
});
