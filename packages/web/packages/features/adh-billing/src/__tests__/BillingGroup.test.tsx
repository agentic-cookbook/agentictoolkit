import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Every member is stubbed: this file is about the GATES and the rail, and mounting five real
// panes would make it about their fetches instead.
//
// Two stubs report a PROP rather than just their own name, because the two Critical findings of
// the final review were both about what BillingGroup hands its members on the mount shape that
// has no URL:
//   · SetupPane renders its `onOpenStripe` as a real button, so a click can be followed;
//   · OffersPane reports whether it was handed a `leaf`, which is what decides between its
//     URL-driven and its internal selection path.
vi.mock("../SetupPane", () => ({
  SetupPane: ({ onOpenStripe }: { onOpenStripe: () => void }) => (
    <div>
      setup-pane
      <button type="button" onClick={onOpenStripe}>
        connect-stripe
      </button>
    </div>
  ),
}));
vi.mock("../OffersPane", () => ({
  OffersPane: ({ leaf }: { leaf?: unknown }) => (
    <div data-testid="offers-pane">{leaf ? "url-driven" : "internal-selection"}</div>
  ),
}));
vi.mock("../PayersPane", () => ({ PayersPane: () => <div>payers-pane</div> }));
vi.mock("../EventsPane", () => ({ EventsPane: () => <div>events-pane</div> }));
// Reports its `leaf` for the same reason OffersPane does. IntegrationsPane picks its selection
// mode off that prop, and it is the ENTIRE billing-side implementation of "connect Stripe" — so
// the mode it is put in decides whether the Stripe topic works at all on the two hosts that cede
// no URL segment.
vi.mock("@agentic-toolkit/integrations", () => ({
  IntegrationsPane: ({ leaf }: { leaf?: unknown }) => (
    <div data-testid="integrations-pane">
      integrations-pane {leaf ? "url-driven" : "internal-selection"}
    </div>
  ),
}));

import { BillingGroup } from "../BillingGroup";

const OK = {
  ecosystemId: "eco_1", billingEnabled: true, canManage: true,
  stripeStatus: "connected" as const, webhookPath: "/api/public/webhooks/stripe/eco_1", isError: false,
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
    // `WorkspaceNotManageable`'s own title, verbatim. The old assertion here matched /Billing/,
    // which the rail ALSO renders as its level title (`title="Billing"`) — so it passed whether
    // or not the gate fired, and deleting the gate would not have failed it.
    expect(screen.getByText(/You don't have admin access to Billing/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offers" })).not.toBeInTheDocument();
  });

  it("shows the rail, and no such notice, for someone who CAN manage", () => {
    // The other half of the pair above: the same query, in the ungated state, must not match.
    // Together they fail in one direction or the other if the gate stops discriminating.
    render(<BillingGroup context={OK} />);
    expect(screen.queryByText(/You don't have admin access to Billing/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Offers" })).toBeInTheDocument();
  });

  // THE regression test for spec §2. A flag-off ecosystem must render the RAIL, because turning
  // the flag on is the first thing Setup is for. Gating on it is the dead end that produced the
  // screenshot: a sentence saying billing is not enabled, with nothing to click.
  it("renders the full rail when billing is disabled", () => {
    render(<BillingGroup context={{ ...OK, billingEnabled: false }} />);
    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("Stripe")).toBeInTheDocument();
  });

  // The rail must render while `GET /billing/context` is still in flight — same rule as the
  // flag-off case above — but the four members that FETCH must not, because every one of their
  // cache keys is built from `ecosystemId` and degrades to a shared bucket while it is undefined.
  it("shows the rail but holds the fetching members while the context is in flight", async () => {
    render(<BillingGroup context={{ ...OK, ecosystemId: undefined }} />);
    expect(screen.getByRole("button", { name: "Offers" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Offers" }));
    expect(screen.queryByTestId("offers-pane")).not.toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    // Setup is the exception: it fetches nothing and disables its own switch on a missing id, so
    // holding it back would hide the one pane that still has something to say.
    await userEvent.click(screen.getByRole("button", { name: "Setup" }));
    expect(await screen.findByText("setup-pane")).toBeInTheDocument();
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

/**
 * The INTERNAL-selection mount: `<BillingGroup context={…} />` with neither `urlSelection` nor
 * `renderSubLeaf`. That is exactly how the hub's workspace rail
 * (`sites/hub/src/components/workspace/feature-panels.tsx`) and the products topic
 * (`sites/products/src/feature-panels.tsx`) mount it — two of the three hosts.
 *
 * Nothing used to render that shape and then INTERACT with it: the cases above render it and
 * assert only on the unselected rail. That gap is why both Critical findings survived a full
 * branch — each broke only after a click, and only on a host nobody was developing against.
 */
describe("BillingGroup on the internal-selection mount", () => {
  it("opens a member when its rail row is clicked", async () => {
    render(<BillingGroup context={OK} />);
    await userEvent.click(screen.getByRole("button", { name: "Setup" }));
    expect(await screen.findByText("setup-pane")).toBeInTheDocument();
  });

  it("routes Setup's Connect Stripe to the Stripe member", async () => {
    // Against the pre-fix code this cannot pass: `onOpenStripe` was
    // `() => urlSelection?.onSelect("stripe")`, and with no `urlSelection` the optional chain
    // evaluates to `undefined` — the button rendered enabled and did nothing at all, so the
    // Stripe member never opened and `setup-pane` never went away.
    render(<BillingGroup context={OK} />);
    await userEvent.click(screen.getByRole("button", { name: "Setup" }));
    await userEvent.click(await screen.findByRole("button", { name: "connect-stripe" }));
    expect(await screen.findByTestId("integrations-pane")).toBeInTheDocument();
    expect(screen.queryByText("setup-pane")).not.toBeInTheDocument();
  });

  it("lets the Stripe member keep its inner selection local", async () => {
    // The Stripe member is `IntegrationsPane`, and it is the whole of "connect Stripe" on this
    // site. Handed a truthy leaf on a host that cedes no segment, it sits in URL-driven mode
    // pinned at "nothing selected": the provider rows render, clicking one selects nothing, and
    // the credential form below them never appears — on the hub and products mounts, forever.
    render(<BillingGroup context={OK} />);
    await userEvent.click(screen.getByRole("button", { name: "Stripe" }));
    expect(await screen.findByTestId("integrations-pane")).toHaveTextContent("internal-selection");
  });

  it("still cedes Stripe's inner selection when the host DOES pass renderSubLeaf", async () => {
    render(
      <BillingGroup
        context={OK}
        urlSelection={{ selectedId: "stripe", onSelect: vi.fn() }}
        renderSubLeaf={() => ({ leafId: "pc_1", onSelect: vi.fn() })}
      />,
    );
    expect(await screen.findByTestId("integrations-pane")).toHaveTextContent("url-driven");
  });

  it("lets a list member keep its inner selection local", async () => {
    // Against the pre-fix code this renders "url-driven" and fails. `StackGroupDetail` hands the
    // active member `LOCAL_SUBLEAF` when the host cedes no deeper segment — a TRUTHY object with
    // a constant `null` id and a no-op `onSelect` — and OffersPane/PayersPane/IntegrationsPane
    // all choose their mode by that object's truthiness. Passing it through pinned them in
    // URL-driven mode at "nothing selected": rows rendered, and clicking one did nothing, on both
    // embeds, forever.
    render(<BillingGroup context={OK} />);
    await userEvent.click(screen.getByRole("button", { name: "Offers" }));
    expect(await screen.findByTestId("offers-pane")).toHaveTextContent("internal-selection");
  });

  it("still cedes the inner selection when the host DOES pass renderSubLeaf", async () => {
    // The other direction, so the fix above cannot be "always pass undefined": the billing site's
    // own route cedes the segment, and its offer deep links must keep working.
    render(
      <BillingGroup
        context={OK}
        urlSelection={{ selectedId: "offers", onSelect: vi.fn() }}
        renderSubLeaf={() => ({ leafId: "of_1", onSelect: vi.fn() })}
      />,
    );
    expect(await screen.findByTestId("offers-pane")).toHaveTextContent("url-driven");
  });
});
