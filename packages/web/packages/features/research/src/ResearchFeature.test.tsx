// @vitest-environment jsdom
//
// Component test for ResearchFeature — the /research workspace: a master/detail surface over
// the signed-in user's markdown research documents. Only the data domain boundary
// (@agentic-toolkit/data/markdown), the Next navigation hook, and @agentic-toolkit/auth's
// useAuth are mocked, so the list-publish → create → open-via-URL wiring is exercised, not the
// transport.
//
// ResearchPane PUBLISHES its documents list as ONE rail level (via useStackLevel) into a rail
// HOST rather than rendering its own list — the button bar (Save/Cancel/Delete) is the only thing
// MasterDetailLeaf renders directly. So the harness below (mirroring ProjectsFeature.test.tsx's
// Rail) renders the published level's "New document" affordance AND its items, standing in for
// the hub's workspace shell.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
} from "@agentic-toolkit/resource";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";

// useBasePathRoute (ResearchFeature's URL wiring) reads next/navigation's useRouter; a stub is
// enough since these tests assert on the API calls, not the resulting route.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// ResearchPane reads useAuth() directly (for the userSlug fallback) — stub a signed-in user so
// it renders without an AuthProvider. reportUnexpectedAuthError is a no-op logger here.
vi.mock("@agentic-toolkit/auth", () => ({
  useAuth: () => ({ user: { name: "Ada Lovelace" } }),
  reportUnexpectedAuthError: vi.fn(),
}));

vi.mock("@agentic-toolkit/data/markdown", () => ({
  markdownApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    categories: vi.fn(),
    tags: vi.fn(),
  },
}));

import { ResearchFeature } from "./ResearchFeature";
import { markdownApi, type ResearchDocument, type ResearchSummary } from "@agentic-toolkit/data/markdown";

const list = vi.mocked(markdownApi.list);
const get = vi.mocked(markdownApi.get);
const create = vi.mocked(markdownApi.create);
const categories = vi.mocked(markdownApi.categories);
const tags = vi.mocked(markdownApi.tags);

const SUMMARY: ResearchSummary = {
  id: "doc-1",
  title: "Federated learning notes",
  category: "ml",
  tags: ["notes"],
  visibility: "private",
  publicRoute: null,
};

const DOCUMENT: ResearchDocument = {
  id: "doc-1",
  title: "Federated learning notes",
  content: "# Federated learning\n\nSome notes.",
  category: "ml",
  tags: ["notes"],
  visibility: "private",
  publicRoute: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([structuredClone(SUMMARY)]);
  get.mockResolvedValue(structuredClone(DOCUMENT));
  create.mockResolvedValue(structuredClone(DOCUMENT));
  categories.mockResolvedValue([]);
  tags.mockResolvedValue([]);
});

// This package's vitest config has no global afterEach, so RTL's auto-cleanup never registers —
// tear down each render explicitly to keep renders from bleeding across tests.
afterEach(cleanup);

/** Renders the published rail affordances (the "New document" button + the document rows) the way
 *  the hub's workspace shell would, so the test can drive the shell-owned rail slot. */
function Rail({ levels }: { levels: TopicLevel[] }) {
  return (
    <div>
      {levels.map((l) => (
        <div key={l.id}>
          {l.onNew && (
            <button type="button" onClick={() => l.onNew?.()}>
              {l.newLabel}
            </button>
          )}
          <ul>
            {l.items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => l.onSelect?.(item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** A minimal rail HOST: it registers ResearchPane's published documents level and exposes the
 *  merged stack the way the hub's workspace shell would (the shell owns `mergedLevels`; this
 *  package owns only the RailHostContext contract). Stands in for the host so the published
 *  "New document" rail affordance and the document rows are drivable. */
function Harness({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, RegisteredLevels>>(new Map());
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
          const next = new Map(m);
          next.delete(id);
          return next;
        }),
      registerExitGuard: () => {},
      toolbarSlot: null,
    }),
    [],
  );
  const mergedLevels = [...entries.values()]
    .sort((a, b) => a.depth - b.depth)
    .flatMap((e) => e.levels);
  return (
    <RailHostContext.Provider value={registry}>
      <Rail levels={mergedLevels} />
      {children}
    </RailHostContext.Provider>
  );
}

describe("ResearchFeature", () => {
  it("publishes the documents list from markdownApi.list", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );

    expect(await screen.findByText("Federated learning notes")).not.toBeNull();
    expect(list).toHaveBeenCalled();
  });

  it("creates a document through the New document rail affordance", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );

    // Open the editor from the published rail affordance (mirrors the "New Project" dialog
    // affordance, but the Research editor opens inline — no dialog).
    fireEvent.click(await screen.findByRole("button", { name: "New document" }));

    // The body is the only required field; title/category/tags stay blank.
    fireEvent.change(screen.getByLabelText("Markdown body"), {
      target: { value: "# Hello research" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ content: "# Hello research" }),
    );
  });

  it("opens the selected document (deep link via docId) with its title + body loaded", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );

    expect(await screen.findByDisplayValue("Federated learning notes")).not.toBeNull();
    const body = screen.getByLabelText("Markdown body") as HTMLTextAreaElement;
    expect(body.value).toBe("# Federated learning\n\nSome notes.");
    await waitFor(() => expect(get).toHaveBeenCalledWith("doc-1"));
  });
});
