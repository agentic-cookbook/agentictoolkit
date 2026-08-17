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
