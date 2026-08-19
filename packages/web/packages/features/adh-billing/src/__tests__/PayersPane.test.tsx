import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RailHostBoundary } from "@agentic-toolkit/resource";

const listAccounts = vi.fn();
const listOffers = vi.fn();
vi.mock("../api/billing", async (orig) => ({
  ...(await orig<typeof import("../api/billing")>()),
  listAccounts: (...a: unknown[]) => listAccounts(...a),
  listOffers: (...a: unknown[]) => listOffers(...a),
  resendClaim: vi.fn(),
}));

import { PayersPane } from "../PayersPane";

describe("PayersPane", () => {
  // The single most important assertion in this file: a 403 is the ORDINARY response for most
  // members of a selling ecosystem, and rendering it as "nobody has bought anything" tells them
  // their product has no customers — false, and unfalsifiable from where they are standing.
  it("names a 403 rather than rendering it as an empty customer list", async () => {
    listAccounts.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    listOffers.mockResolvedValue([]);
    // Wrapped in a RailHostBoundary: that copy only ever reaches the rail (it's `emptyLabel`),
    // and `useStackLevel` is a documented no-op outside a rail host, so without a host this
    // negative assertion has nothing to be false about — a regression that dropped the
    // `loadError ??` from `emptyLabel` would still pass.
    render(
      <RailHostBoundary>
        <PayersPane ecosystemId="eco_1" />
      </RailHostBoundary>,
    );
    expect(await screen.findByText(/owners only/i)).toBeInTheDocument();
    expect(screen.queryByText(/nobody has bought/i)).not.toBeInTheDocument();
  });

  it("says billing is not enabled on a 404, which is the one 4xx an owner can act on", async () => {
    listAccounts.mockRejectedValue(Object.assign(new Error("nope"), { status: 404 }));
    listOffers.mockResolvedValue([]);
    render(<PayersPane ecosystemId="eco_1" />);
    expect(await screen.findByText(/not enabled/i)).toBeInTheDocument();
  });
});
