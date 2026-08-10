// @vitest-environment jsdom
//
// The host-injected Transfer Ownership seam: that the pane calls it with the ACTIVE record, places
// it above the Danger Zone, and renders nothing at all when the host injects none (a standalone
// feature site) or when no record is selected.
//
// `./EcosystemForm` is module-mocked because `useRdidAvailability` calls react-query's `useQuery`,
// which throws without a QueryClientProvider. Same prop-echoing-stub idiom as personas'
// PersonaEditor.test.tsx. Nothing else in the pane's tree touches react-query (@agentic-toolkit/
// resource has no react-query dependency at all), so this one mock is the whole harness.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { Ecosystem } from "@agentic-toolkit/data/ecosystems";

// The stub ECHOES the two props that carry the pane's answer to "what is this row's slug?", so
// the sourcing test below asserts what the field was handed rather than what it rendered (the
// real field is a controlled input in a package this file deliberately does not load).
vi.mock("./EcosystemForm", () => ({
  EcosystemFields: ({ prefix, slug }: { prefix: string; slug: string }) => (
    <div data-testid="eco-fields" data-prefix={prefix} data-slug={slug} />
  ),
  ecoCreateRdidValid: () => true,
  useRdidAvailability: () => "idle",
}));

import { EcosystemSettingsPane } from "./EcosystemSettingsPane";

afterEach(cleanup);

const WIDGETS: Ecosystem = {
  id: "ecosystem.acme.widgets",
  identifier: "ecosystem.acme.widgets",
  slug: "widgets",
  name: "Widgets",
  description: "",
  region: "",
  domain: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// Echoes back what the seam was handed, so "called with the ACTIVE record" is directly assertable
// rather than inferred from the node merely existing.
const seam = (e: { id: string; identifier: string }) => (
  <div data-testid="transfer" data-id={e.id} data-identifier={e.identifier} />
);

function renderPane(props: Partial<ComponentProps<typeof EcosystemSettingsPane>> = {}) {
  return render(
    <EcosystemSettingsPane
      noun="Product"
      ecosystemId={WIDGETS.id}
      items={[WIDGETS]}
      refresh={() => {}}
      {...props}
    />,
  );
}

describe("EcosystemSettingsPane transfer seam", () => {
  it("renders the host's seam, handed the active ecosystem", () => {
    renderPane({ renderTransferOwnership: seam });
    const node = screen.getByTestId("transfer");
    expect(node.getAttribute("data-id")).toBe("ecosystem.acme.widgets");
    expect(node.getAttribute("data-identifier")).toBe("ecosystem.acme.widgets");
  });

  it("renders nothing where the host injects no seam", () => {
    renderPane();
    expect(screen.queryByTestId("transfer")).toBeNull();
  });

  it("renders nothing when no record is active", () => {
    renderPane({ ecosystemId: "ecosystem.acme.gone", renderTransferOwnership: seam });
    expect(screen.queryByTestId("transfer")).toBeNull();
  });

  // Order matters: the Danger Zone is terminal, so anything below it reads as part of it.
  // compareDocumentPosition is the only oracle here — both sections exist either way, so a
  // presence assertion would pass with them swapped.
  it("places the seam ABOVE the Danger Zone", () => {
    renderPane({ renderTransferOwnership: seam, onDelete: async () => {} });
    const transfer = screen.getByTestId("transfer");
    const danger = screen.getByRole("region", { name: "Danger Zone" });
    expect(transfer.compareDocumentPosition(danger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// A row's rdid is the handle stored for it; its address is DERIVED from `<parent chain>.<slug>`.
// They are the same string until something writes one without the other — a bare handle rename,
// a backfill, or (before 2026-08-10) a slug rename whose cascade moved the descendants and left
// the row's own handle behind. The hub's own product sat drifted that way, and the field labelled
// "Slug" showed `agenticdeveloperhub` while the slug column said something else entirely.
describe("EcosystemSettingsPane slug sourcing", () => {
  const DRIFTED: Ecosystem = { ...WIDGETS, slug: "gadgets" };

  it("hands the field the STORED SLUG, not the handle's last segment", () => {
    renderPane({ ecosystemId: DRIFTED.id, items: [DRIFTED] });
    const fields = screen.getByTestId("eco-fields");
    expect(fields.getAttribute("data-slug")).toBe("gadgets");
    // The scope still comes from the handle — a rename moves the leaf, never the parent chain.
    expect(fields.getAttribute("data-prefix")).toBe("ecosystem.acme.");
  });

  it("shows the slug unchanged where handle and slug agree", () => {
    renderPane();
    expect(screen.getByTestId("eco-fields").getAttribute("data-slug")).toBe("widgets");
  });
});
