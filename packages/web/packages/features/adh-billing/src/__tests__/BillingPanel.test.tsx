// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authedJson } = vi.hoisted(() => ({ authedJson: vi.fn() }));
vi.mock("@agentic-toolkit/auth/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/auth/client")>()),
  authedJson,
}));

import { BillingPanel } from "../BillingPanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const OFFER = {
  id: "o1",
  slug: "pro",
  name: "Pro",
  purpose: "access",
  stripePriceId: "price_1",
  collectionMethod: "charge_automatically",
  daysUntilDue: null,
  grantsEcosystemId: "eco-1",
  lapseAction: "no_access",
  graceDays: 0,
  isActive: true,
};

function route(map: Record<string, unknown>) {
  authedJson.mockImplementation((path: string) => Promise.resolve(map[path] ?? []));
}

describe("BillingPanel", () => {
  it("renders an offer's amount from the LIVE Stripe price, not a stored one", async () => {
    route({
      "/api/billing/offers": [OFFER],
      "/api/billing/prices": [
        {
          id: "price_1",
          productId: "prod_1",
          productName: "Pro",
          unitAmount: 2500,
          currency: "usd",
          interval: "month",
        },
      ],
    });
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(screen.getByText("$25.00/month")).toBeTruthy());
  });

  // The benefit of not caching the amount: a deleted Stripe price says so instead of showing a
  // number that is no longer for sale.
  it("says an offer is missing in Stripe rather than showing a stale figure", async () => {
    route({ "/api/billing/offers": [OFFER], "/api/billing/prices": [] });
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(screen.getByText("missing in Stripe")).toBeTruthy());
  });

  it("flags an unclaimed payer, which is the state that needs an operator's attention", async () => {
    route({
      "/api/billing/accounts": [
        {
          id: "a1",
          offerId: "o1",
          payerEmail: "payer@example.com",
          status: "active",
          currentPeriodEnd: null,
          lapsedAt: null,
          claimedCustomerId: null,
        },
      ],
    });
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(screen.getByText(/unclaimed/)).toBeTruthy());
  });

  // `GET /billing/accounts` is `requireAdmin` (every row carries a payer's email), so a 403 is
  // the ORDINARY response for a non-admin member — not an edge case. Before this branch existed
  // the read failed, `accounts` stayed null, and the length check downstream rendered "Nobody has
  // bought anything yet": a selling product told its own members it had no customers. Asserting
  // the absence too, because the regression is not that the notice is missing — it is that the
  // false one comes back.
  it("says payers are admin-only when the accounts read is refused, never that there are none", async () => {
    authedJson.mockImplementation((path: string) =>
      path === "/api/billing/accounts"
        ? Promise.reject(new Error("403 Forbidden"))
        : Promise.resolve([]),
    );
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(screen.getByText(/visible to product admins only/)).toBeTruthy());
    expect(screen.queryByText("Nobody has bought anything yet.")).toBeNull();
  });

  // The `/api` prefix has no visible symptom to assert on: without it the calls resolve against
  // the Next app, which answers 404 HTML, and the panel renders its ordinary empty states. So
  // this asserts the transport directly — it is the only place the prefix is observable, and it
  // is the defect this brief exists to correct.
  it("calls the backend through the /api prefix, not the Next app's own routes", async () => {
    route({ "/api/billing/offers": [OFFER] });
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(authedJson).toHaveBeenCalledWith("/api/billing/offers"));
    expect(authedJson).toHaveBeenCalledWith("/api/billing/accounts");
    expect(authedJson).toHaveBeenCalledWith("/api/billing/prices");
  });
});
