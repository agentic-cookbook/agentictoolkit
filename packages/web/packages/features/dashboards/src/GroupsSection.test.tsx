// The host-injected Transfer Ownership seam on GroupsSection: that the INLINE editor renders it
// for the open group, that the "New group" POPUP does not, and that it names the saved row rather
// than the live draft. This package's vitest config is jsdom (see vitest.config.ts) and drives
// React with @testing-library/react.
//
// GroupsSection is rendered directly rather than through DashboardsFeature: selection is a prop
// here (`leaf`), so a group can be opened without a router, and the popup is one rail click away.
// Only the data domain boundary (@agentic-toolkit/data/monitored-sites) is mocked — the three
// writers the section imports — so the section → editor → seam wiring is exercised, not the
// transport.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
} from "@agentic-toolkit/resource";

vi.mock("@agentic-toolkit/data/monitored-sites", () => ({
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));

import { GroupsSection } from "./GroupsSection";
import type { SiteGroupView } from "@agentic-toolkit/data/monitored-sites";

const GROUP: SiteGroupView = {
  id: "g1",
  slug: "core-apis",
  name: "Core APIs",
  retentionDays: 30,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

// Echoes back what the seam was handed, so "called with the SAVED group" is directly assertable
// rather than inferred from the node merely existing. Same idiom as ecosystems'
// EcosystemSettingsPane.test.tsx.
const seam = (g: { id: string; name: string }) => (
  <div data-testid="transfer" data-id={g.id} data-name={g.name} />
);

/** A minimal rail HOST. GroupsSection PUBLISHES its list level — rows and the "New group" button —
 *  rather than rendering it, so the creation popup is reachable only through a host. This renders
 *  just that one affordance, over the same RailHostContext contract DashboardsFeature.test.tsx's
 *  fuller harness uses. */
function Harness({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, RegisteredLevels>>(new Map());
  const registry: RailHostRegistry = useMemo(
    () => ({
      registerLevels: (id, entry) => setEntries((m) => new Map(m).set(id, entry)),
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
  return (
    <RailHostContext.Provider value={registry}>
      {[...entries.values()]
        .flatMap((e) => e.levels)
        .map((l) => (
          <button key={l.id} type="button" onClick={() => l.onNew?.()}>
            {l.newLabel}
          </button>
        ))}
      {children}
    </RailHostContext.Provider>
  );
}

function renderSection(props: Partial<ComponentProps<typeof GroupsSection>> = {}) {
  return render(
    <Harness>
      <GroupsSection
        groups={[structuredClone(GROUP)]}
        onChanged={async () => {}}
        leaf={{ leafId: "g1", onSelect: () => {} }}
        {...props}
      />
    </Harness>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Explicit and redundant, deliberately: this package's vitest runs with `globals: true`
// (packages/web/packages/features/vitest.preset.ts:16), so RTL 16.3.2's own shipped
// `afterEach(cleanup)` DOES register (@testing-library/react/dist/index.js:23-30), and cleanup
// is idempotent. An earlier version of this comment asserted the opposite — no global afterEach,
// auto-cleanup never registers — and both halves were false. Keep the call if you like it as a
// local statement of intent; do not "fix" the config to match the claim that was here.
afterEach(cleanup);

describe("GroupsSection transfer seam", () => {
  it("renders the host's seam, handed the open group", () => {
    renderSection({ renderTransferOwnership: seam });

    const node = screen.getByTestId("transfer");
    expect(node.getAttribute("data-id")).toBe("g1");
    expect(node.getAttribute("data-name")).toBe("Core APIs");
  });

  it("renders nothing where the host injects no seam", () => {
    renderSection();

    expect(screen.getByDisplayValue("Core APIs")).not.toBeNull();
    expect(screen.queryByTestId("transfer")).toBeNull();
  });

  it("renders nothing when no group is open", () => {
    renderSection({ leaf: { leafId: null, onSelect: () => {} }, renderTransferOwnership: seam });

    expect(screen.getByText("Select a group to edit, or create a new one.")).not.toBeNull();
    expect(screen.queryByTestId("transfer")).toBeNull();
  });

  // The trap the section's own comment names: GroupDetail is rendered TWICE — inline by
  // MasterDetailLeaf's renderDetail, and again by the "New group" popup's renderForm. A seam
  // placed inside GroupDetail itself would appear in the popup and offer to move a group that
  // does not exist yet. Asserted with the popup open OVER an open group, so the seam is on
  // screen and the only question is which subtree holds it.
  it("never reaches the New group popup", () => {
    renderSection({ renderTransferOwnership: seam });

    fireEvent.click(screen.getByRole("button", { name: "New group" }));
    const dialog = screen.getByRole("dialog", { name: "New group" });

    // The popup builds its own GroupDetail (a blank draft). Found by placeholder, not by label:
    // GroupDetail hardcodes `id="grp-name"` (GroupDetail.tsx:70), so with both copies mounted the
    // label's htmlFor resolves to the FIRST input in the document — the inline editor's, outside
    // this subtree.
    expect((within(dialog).getByPlaceholderText("Core APIs") as HTMLInputElement).value).toBe("");
    // …and no seam anywhere inside it.
    expect(within(dialog).queryByTestId("transfer")).toBeNull();
    // Exactly one on screen: the inline editor's.
    expect(screen.getAllByTestId("transfer")).toHaveLength(1);
  });

  // The section hands over `form.selected` (the SAVED row, resolved from `groups` by the selected
  // id), NOT the draft the fields above are bound to. Swapping to the draft would compile and pass
  // every other test here, and would name the confirmation dialog after a rename the server has
  // never seen.
  it("keeps naming the SAVED group while a rename is unsaved", () => {
    renderSection({ renderTransferOwnership: seam });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Payments" } });

    // The field took the edit…
    expect(screen.getByDisplayValue("Payments")).not.toBeNull();
    // …and the seam still names the row the server knows.
    expect(screen.getByTestId("transfer").getAttribute("data-name")).toBe("Core APIs");
  });
});
