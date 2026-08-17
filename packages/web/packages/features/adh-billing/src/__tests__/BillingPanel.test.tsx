// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authedJson } = vi.hoisted(() => ({ authedJson: vi.fn() }));
vi.mock("@agentic-toolkit/auth/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/auth/client")>()),
  authedJson,
}));

import { AuthHttpError } from "@agentic-toolkit/auth/client";

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

  // `GET /billing/accounts` and `GET /billing/prices` are both `requireAdmin` (accounts rows carry
  // payer emails), so a 403 is the ORDINARY response for a non-admin member — not an edge case.
  // Before these branches existed both reads failed, both lists stayed null, and the length checks
  // downstream rendered the empty states: a selling product told its own members it had no
  // customers and no Stripe prices. Asserting the ABSENCE of each false line too, because the
  // regression is not that the notice goes missing — it is that the falsehood comes back.
  //
  // The rejection is a real `AuthHttpError`, not a plain Error with 403 in its message: the panel
  // branches on `instanceof` + `.status`, so a stringly-typed stand-in would take the generic
  // branch and this test would assert nothing about the code that ships.
  it("says the admin-only reads are admin-only when refused, never that there is nothing there", async () => {
    authedJson.mockImplementation((path: string) =>
      path === "/api/billing/accounts" || path === "/api/billing/prices"
        ? Promise.reject(new AuthHttpError(403, "forbidden"))
        : Promise.resolve([]),
    );
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(screen.getByText(/Payer details are visible/)).toBeTruthy());
    expect(screen.getByText(/Stripe details are visible/)).toBeTruthy();
    expect(screen.queryByText("Nobody has bought anything yet.")).toBeNull();
    expect(screen.queryByText(/no restricted Stripe key is connected/)).toBeNull();
  });

  // The inversion of the test above, and the reason the panel checks the STATUS rather than merely
  // "did this error". An admin who hits a 500 must not be told they lack admin rights — that sends
  // the one person who can fix it to go looking at permissions.
  it("does not blame permissions for a failure that is not a 403", async () => {
    authedJson.mockImplementation((path: string) =>
      path === "/api/billing/accounts"
        ? Promise.reject(new AuthHttpError(500, "boom"))
        : Promise.resolve([]),
    );
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(screen.getByText("Payer details could not be loaded.")).toBeTruthy());
    expect(screen.queryByText(/Payer details are visible/)).toBeNull();
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
