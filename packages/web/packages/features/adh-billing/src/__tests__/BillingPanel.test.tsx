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

  // `GET /billing/accounts` and `GET /billing/prices` are both behind `requireBillingOperator`
  // (accounts rows carry payer emails), so a 403 is the ORDINARY response for a member who does
  // not own the ecosystem — not an edge case.
  // Before these branches existed both reads failed, both lists stayed null, and the length checks
  // downstream rendered the empty states: a selling product told its own members it had no
  // customers and no Stripe prices. Asserting the ABSENCE of each false line too, because the
  // regression is not that the notice goes missing — it is that the falsehood comes back.
  //
  // The rejection is a real `AuthHttpError`, not a plain Error with 403 in its message: the status
  // reaches the panel as `useResourceList`'s `errorStatus`, read off the thrown error's numeric
  // `.status`, so a stand-in carrying the code only in its message would take the generic branch
  // and this test would assert nothing about the code that ships.
  it("says the owner-only reads are owner-only when refused, never that there is nothing there", async () => {
    authedJson.mockImplementation((path: string) =>
      path === "/api/billing/accounts" || path === "/api/billing/prices"
        ? Promise.reject(new AuthHttpError(403, "forbidden"))
        : Promise.resolve([]),
    );
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(screen.getByText(/Payer details are visible/)).toBeTruthy());
    expect(screen.getByText(/Stripe details are visible/)).toBeTruthy();
    expect(screen.queryByText("Nobody has bought anything yet.")).toBeNull();
    // Both of the Stripe section's non-403 lines, by their real current wording. A regex for copy
    // no longer in the component would pass forever while asserting nothing.
    expect(screen.queryByText(/Stripe is not active for this product/)).toBeNull();
    expect(screen.queryByText(/has no active prices yet/)).toBeNull();
  });

  // 409 is the one status this panel translates into a setup step rather than a bug, so it is
  // worth pinning: `routes/billing.ts` maps `StripeNotConfiguredError` to it for that reason. It
  // arrives as a thrown error, never as an empty list, which is why the empty-state copy must be
  // absent here. The assertion deliberately does NOT pin a remedy — that error covers three
  // conditions (no config row, paused, empty key) and naming one of them would be a guess.
  it("names the inactive Stripe connection on a 409 instead of reporting an empty catalog", async () => {
    authedJson.mockImplementation((path: string) =>
      path === "/api/billing/prices"
        ? Promise.reject(new AuthHttpError(409, "connect a Stripe account before listing prices"))
        : Promise.resolve([]),
    );
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(screen.getByText(/Stripe is not active for this product/)).toBeTruthy());
    expect(screen.queryByText(/has no active prices yet/)).toBeNull();
    expect(screen.queryByText("Stripe prices could not be loaded.")).toBeNull();
    expect(screen.queryByText(/Stripe details are visible/)).toBeNull();
  });

  // `requireBillingOperator` answers 404 — not 403 — when the `billing` ecosystem flag is off, and
  // it asks that BEFORE the ownership check. The two statuses therefore mean different things to
  // different readers (the product is not selling / you are not its owner), and the panel must not
  // collapse them: an owner told they lack permission goes looking for a role they already hold.
  it("distinguishes billing being disabled from the reader lacking ownership", async () => {
    authedJson.mockImplementation((path: string) =>
      path === "/api/billing/accounts" || path === "/api/billing/prices"
        ? Promise.reject(new AuthHttpError(404, "billing is not enabled for this ecosystem"))
        : Promise.resolve([]),
    );
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() =>
      expect(screen.getAllByText("Billing is not enabled for this product.")).toHaveLength(2),
    );
    expect(screen.queryByText(/Payer details are visible/)).toBeNull();
    expect(screen.queryByText(/Stripe details are visible/)).toBeNull();
    expect(screen.queryByText("Nobody has bought anything yet.")).toBeNull();
    expect(screen.queryByText(/has no active prices yet/)).toBeNull();
  });

  // The inversion of the test above, and the reason the panel checks the STATUS rather than merely
  // "did this error". An owner who hits a 500 must not be told they lack rights — that sends
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

  // The same defect as the two tests above, reached through the offer/price JOIN rather than
  // through a section header — and the place it actually shipped. `/prices` is owners-only, so a
  // non-owner member loading a product with a working catalog saw every offer labelled "missing
  // in Stripe": a failed read of OUR OWN making, rendered as a fact about the operator's Stripe
  // account. `/offers` must succeed here, or no row renders and the test asserts nothing.
  it("does not call an offer's price missing in Stripe when the price list failed to load", async () => {
    authedJson.mockImplementation((path: string) =>
      path === "/api/billing/prices"
        ? Promise.reject(new AuthHttpError(403, "forbidden"))
        : path === "/api/billing/offers"
          ? Promise.resolve([OFFER])
          : Promise.resolve([]),
    );
    render(<BillingPanel workspaceSlug="acme" />);
    await waitFor(() => expect(screen.getByText("price could not be loaded")).toBeTruthy());
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.queryByText("missing in Stripe")).toBeNull();
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
