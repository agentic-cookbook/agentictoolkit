import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Every member is stubbed: this file is about the GATES and the rail, and mounting five real
// panes would make it about their fetches instead.
vi.mock("../SetupPane", () => ({ SetupPane: () => <div>setup-pane</div> }));
vi.mock("../OffersPane", () => ({ OffersPane: () => <div>offers-pane</div> }));
vi.mock("../PayersPane", () => ({ PayersPane: () => <div>payers-pane</div> }));
vi.mock("../EventsPane", () => ({ EventsPane: () => <div>events-pane</div> }));
vi.mock("@agentic-toolkit/integrations", () => ({ IntegrationsPane: () => <div>integrations-pane</div> }));

import { BillingGroup } from "../BillingGroup";

const OK = {
  ecosystemId: "eco_1", billingEnabled: true, canManage: true,
  stripeConnected: true, webhookPath: "/api/public/webhooks/stripe/eco_1", isError: false,
};

describe("BillingGroup gates", () => {
  it("shows the resolution error when the context read failed", () => {
    render(<BillingGroup context={{ ...OK, isError: true }} />);
    expect(screen.queryByText("Setup")).not.toBeInTheDocument();
    // Positive: `WorkspaceResolutionError`'s title, verbatim, so a BillingGroup that returned an
    // empty fragment on `isError` (which would still pass the absence check above) fails here.
    expect(screen.getByText(/Couldn't load this workspace/i)).toBeInTheDocument();
  });

  it("shows the not-manageable notice for a viewer", () => {
    render(<BillingGroup context={{ ...OK, canManage: false }} />);
    expect(screen.getByText(/Billing/)).toBeInTheDocument();
    expect(screen.queryByText("Offers")).not.toBeInTheDocument();
  });

  // THE regression test for spec §2. A flag-off ecosystem must render the RAIL, because turning
  // the flag on is the first thing Setup is for. Gating on it is the dead end that produced the
  // screenshot: a sentence saying billing is not enabled, with nothing to click.
  it("renders the full rail when billing is disabled", () => {
    render(<BillingGroup context={{ ...OK, billingEnabled: false }} />);
    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("Stripe")).toBeInTheDocument();
  });

  it("opens unselected", () => {
    render(<BillingGroup context={OK} />);
    expect(screen.queryByText("setup-pane")).not.toBeInTheDocument();
  });

  it("opens the member named by urlSelection", () => {
    render(<BillingGroup context={OK} urlSelection={{ selectedId: "setup", onSelect: vi.fn() }} />);
    expect(screen.getByText("setup-pane")).toBeInTheDocument();
  });
});
