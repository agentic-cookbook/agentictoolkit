// @vitest-environment jsdom
//
// Component test for WorkItemComments — the conversation on a card.
//
// Only the api-client boundaries are mocked (@agentic-toolkit/data/projects and
// @agentic-toolkit/data/reactions), so the load → post → reload wiring, the threading, and the
// reaction toggle are exercised rather than the transport.
//
// @agentic-toolkit/data is NOT wholesale-mocked, for the same reason WorkItemRelations' test
// leaves it alone: the pane runs through the REAL useResourceList, whose module-scope cache is
// keyed `work-item:<id>:comments` and OUTLIVES cleanup(). Every test therefore uses its own item
// id, or it would seed the next one's first paint with rows that test never stubbed. The one
// thing overridden there is `readTokenSubject`, which decides who the viewer is — the fact the
// author-only Edit control turns on.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

const VIEWER = "cust-1";

vi.mock("@agentic-toolkit/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data")>()),
  readTokenSubject: () => VIEWER,
}));

vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/projects")>()),
  projectCommentsApi: {
    list: vi.fn(),
    add: vi.fn(),
    edit: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@agentic-toolkit/data/reactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/reactions")>()),
  reactionsApi: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
}));

import { WorkItemComments } from "./WorkItemComments";
import { projectCommentsApi, type ProjectComment } from "@agentic-toolkit/data/projects";
import { reactionsApi, type Reaction } from "@agentic-toolkit/data/reactions";

const list = vi.mocked(projectCommentsApi.list);
const add = vi.mocked(projectCommentsApi.add);
const edit = vi.mocked(projectCommentsApi.edit);
const remove = vi.mocked(projectCommentsApi.remove);
const listReactions = vi.mocked(reactionsApi.list);
const addReaction = vi.mocked(reactionsApi.add);
const removeReaction = vi.mocked(reactionsApi.remove);

function comment(over: Partial<ProjectComment> & Pick<ProjectComment, "id">): ProjectComment {
  return {
    projectId: "p1",
    workItemId: "w1",
    parentId: null,
    authorKind: "customer",
    authorId: "cust-2",
    authorLabel: "Grace",
    body: `body ${over.id}`,
    editedAt: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

function reaction(over: Partial<Reaction> & Pick<Reaction, "id" | "targetId">): Reaction {
  return {
    customerId: "cust-2",
    targetKind: "project.comments",
    emoji: "👍",
    createdAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([]);
  listReactions.mockResolvedValue([]);
  add.mockResolvedValue(comment({ id: "new" }));
  edit.mockResolvedValue(comment({ id: "c1", body: "fixed", editedAt: "2026-08-02T00:00:00Z" }));
  remove.mockResolvedValue(undefined);
  addReaction.mockResolvedValue(reaction({ id: "r9", targetId: "c1" }));
  removeReaction.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("WorkItemComments", () => {
  it("does not claim a card has no comments while the read is still outstanding", async () => {
    // "No comments yet" is an assertion about the card; before the list lands, the pane does not
    // know it, and an empty list drawn early would flash a wrong fact.
    let settle: (rows: ProjectComment[]) => void = () => {};
    list.mockReturnValue(
      new Promise<ProjectComment[]>((resolve) => {
        settle = resolve;
      }),
    );
    render(<WorkItemComments workItemId="loading" />);

    expect(screen.getByText("Loading…")).not.toBeNull();
    expect(screen.queryByText("No comments yet.")).toBeNull();

    settle([comment({ id: "c1", body: "Looks right to me" })]);
    expect(await screen.findByText("Looks right to me")).not.toBeNull();
  });

  it("files a reply under its root rather than beside it", async () => {
    // The backend flattens a reply-to-a-reply onto the root, which is exactly why Reply is
    // offered on roots only — a control that filed the answer somewhere else would be worse than
    // no control. Two roots, one reply: three comments, but only two things to reply TO.
    list.mockResolvedValue([
      comment({ id: "c1", body: "Question" }),
      comment({ id: "c2", body: "Answer", parentId: "c1" }),
      comment({ id: "c3", body: "Separate point" }),
    ]);
    render(<WorkItemComments workItemId="threading" />);
    await screen.findByText("Question");

    expect(screen.getAllByRole("button", { name: /^Reply to / })).toHaveLength(2);
  });

  it("posts a trimmed comment and reloads, then clears the composer", async () => {
    render(<WorkItemComments workItemId="posting" />);
    await screen.findByText("No comments yet.");

    const box = screen.getByLabelText("Add a comment") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "  Nice work  " } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    // Two arguments, not three: a top-level comment carries no parent at all, so the client is
    // never handed an explicit `undefined` to compact away.
    await waitFor(() => expect(add).toHaveBeenCalledWith("posting", "Nice work"));
    // Two GETs: the mount's and the one after the write.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(box.value).toBe(""));
  });

  it("submits on ⌘/Ctrl+Enter but leaves a bare Enter to make a paragraph", async () => {
    // The body is prose. A composer that posted on Enter would make a second paragraph
    // impossible to type.
    render(<WorkItemComments workItemId="chord" />);
    await screen.findByText("No comments yet.");

    const box = screen.getByLabelText("Add a comment");
    fireEvent.change(box, { target: { value: "first line" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(add).not.toHaveBeenCalled();

    fireEvent.keyDown(box, { key: "Enter", metaKey: true });
    await waitFor(() => expect(add).toHaveBeenCalledWith("chord", "first line"));
  });

  it("sends a reply with its parent", async () => {
    list.mockResolvedValue([comment({ id: "c1", body: "Question" })]);
    render(<WorkItemComments workItemId="replying" />);
    await screen.findByText("Question");

    fireEvent.click(screen.getByRole("button", { name: "Reply to Grace's comment" }));
    fireEvent.change(screen.getByLabelText("Write a reply"), { target: { value: "Because." } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    await waitFor(() => expect(add).toHaveBeenCalledWith("replying", "Because.", "c1"));
  });

  it("offers Edit on the viewer's OWN comment only", async () => {
    // Reach for editing is knowable here — the comment carries its author — so the control is
    // simply absent for anyone else, rather than offered and then refused.
    list.mockResolvedValue([
      comment({ id: "c1", authorId: VIEWER, authorLabel: "Ada", body: "Mine" }),
      comment({ id: "c2", authorId: "cust-2", authorLabel: "Grace", body: "Theirs" }),
    ]);
    render(<WorkItemComments workItemId="editable" />);
    await screen.findByText("Mine");

    expect(screen.getByRole("button", { name: "Edit Ada's comment" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Grace's comment" })).toBeNull();
    // Remove, by contrast, is offered on both: reach for it is computed server-side from roles
    // the client never sees, and the common case is that a team member holds it.
    expect(screen.getByRole("button", { name: "Remove Grace's comment" })).not.toBeNull();
  });

  it("edits a comment through the comment's own id", async () => {
    list.mockResolvedValue([comment({ id: "c1", authorId: VIEWER, authorLabel: "Ada" })]);
    render(<WorkItemComments workItemId="editing" />);
    await screen.findByText("body c1");

    fireEvent.click(screen.getByRole("button", { name: "Edit Ada's comment" }));
    const box = screen.getByLabelText("Edit Ada's comment") as HTMLTextAreaElement;
    // The box opens holding the current text — an edit starts from what is there, not blank.
    expect(box.value).toBe("body c1");
    fireEvent.change(box, { target: { value: "fixed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(edit).toHaveBeenCalledWith("c1", "fixed"));
  });

  it("confirms before taking someone's words away, and says the replies stay", async () => {
    list.mockResolvedValue([comment({ id: "c1" })]);
    render(<WorkItemComments workItemId="removing" />);
    await screen.findByText("body c1");

    fireEvent.click(screen.getByRole("button", { name: "Remove Grace's comment" }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText(/Any replies to it stay/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("c1"));
  });

  it("reads the WHOLE thread's reactions in one batched call", async () => {
    // One call for N comments is the point of the polymorphic store's batch parameter; a per-row
    // fetch would put a request behind every comment on a long card.
    list.mockResolvedValue([comment({ id: "c1" }), comment({ id: "c2" })]);
    render(<WorkItemComments workItemId="batched" />);
    await screen.findByText("body c1");

    await waitFor(() =>
      expect(listReactions).toHaveBeenCalledWith("project.comments", ["c1", "c2"]),
    );
  });

  it("shows a chip as pressed for the viewer and takes the reaction back by ITS id", async () => {
    // `mine` carries the reaction id because that is what un-reacting addresses — an emoji alone
    // would not say whose reaction to withdraw.
    list.mockResolvedValue([comment({ id: "c1" })]);
    listReactions.mockResolvedValue([
      reaction({ id: "r1", targetId: "c1", customerId: VIEWER }),
      reaction({ id: "r2", targetId: "c1", customerId: "cust-2" }),
    ]);
    render(<WorkItemComments workItemId="unreacting" />);

    const chip = await screen.findByRole("button", { name: "👍 2 on Grace's comment" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(chip);
    await waitFor(() => expect(removeReaction).toHaveBeenCalledWith("r1"));
    expect(addReaction).not.toHaveBeenCalled();
  });

  it("adds a reaction the viewer has not made, naming the comment as the subject", async () => {
    list.mockResolvedValue([comment({ id: "c1" })]);
    listReactions.mockResolvedValue([
      reaction({ id: "r2", targetId: "c1", customerId: "cust-2" }),
    ]);
    render(<WorkItemComments workItemId="reacting" />);

    const chip = await screen.findByRole("button", { name: "👍 1 on Grace's comment" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(chip);
    await waitFor(() =>
      expect(addReaction).toHaveBeenCalledWith("project.comments", "c1", "👍"),
    );
  });

  it("reports a refused write instead of leaving the draft looking sent", async () => {
    add.mockRejectedValue(new Error("you do not have permission to comment here"));
    render(<WorkItemComments workItemId="refused" />);
    await screen.findByText("No comments yet.");

    fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    // The backend's own words, and the text is still in the box to try again with.
    expect(
      await screen.findByText("you do not have permission to comment here"),
    ).not.toBeNull();
    expect((screen.getByLabelText("Add a comment") as HTMLTextAreaElement).value).toBe("hello");
  });

  it("marks an edited comment as edited", async () => {
    list.mockResolvedValue([comment({ id: "c1", editedAt: "2026-08-02T00:00:00Z" })]);
    render(<WorkItemComments workItemId="edited-marker" />);

    const row = (await screen.findByText("body c1")).closest("li");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("(edited)")).not.toBeNull();
  });
});
