import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setEcosystemFlag = vi.fn();
vi.mock("../api/feature-flags", () => ({ setEcosystemFlag: (...a: unknown[]) => setEcosystemFlag(...a) }));

import { SetupPane } from "../SetupPane";

const READY = {
  ecosystemId: "eco_1", billingEnabled: false, canManage: true,
  stripeStatus: "not_connected" as const,
  webhookPath: "/api/public/webhooks/stripe/eco_1", isError: false,
};

// The switch is queried by "Sell through this ecosystem" — its VISIBLE caption, which is also its
// accessible name via `aria-labelledby`. "Billing enabled" is the FieldGroup's heading, a sibling,
// and contributes nothing to the control's name. Do not "fix" a failure here by adding an
// `aria-label` back to the Switch: a visible label plus a different accessible name is the WCAG
// 2.5.3 failure SetupPane.tsx's own comment says it removed on purpose, and it breaks voice control.
describe("SetupPane", () => {
  it("writes the flag through setEcosystemFlag and re-reads the context", async () => {
    setEcosystemFlag.mockResolvedValue(undefined);
    const onChanged = vi.fn();
    render(<SetupPane context={READY} onChanged={onChanged} onOpenStripe={vi.fn()} />);

    await userEvent.click(screen.getByRole("switch", { name: /sell through this ecosystem/i }));
    await waitFor(() => expect(setEcosystemFlag).toHaveBeenCalledWith("eco_1", "billing", true, expect.any(String)));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  // The webhook endpoint is a step an operator will reasonably do BEFORE flipping the switch,
  // so it is not gated on the flag.
  it("shows the webhook endpoint even with billing disabled", () => {
    render(<SetupPane context={READY} onChanged={vi.fn()} onOpenStripe={vi.fn()} />);
    expect(screen.getByText(/webhooks\/stripe\/eco_1/)).toBeInTheDocument();
  });

  it("reports the Stripe connection rather than editing it", async () => {
    render(<SetupPane context={READY} onChanged={vi.fn()} onOpenStripe={vi.fn()} />);
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
    // No credential field anywhere: two edit surfaces for one credential is the thing this design
    // exists to avoid.
    expect(screen.queryByLabelText(/restricted/i)).not.toBeInTheDocument();
  });

  // `unknown` means the connection read THREW — in this fleet, a missing or rotated
  // SECRETS_ENCRYPTION_KEY. Rendering that as "Not connected" with a "Connect Stripe" button
  // sends the operator to re-paste a key that was never the problem, and the row does not change
  // when they do. Both halves are asserted: the caption must not claim a state we cannot see,
  // and the button must not name the wrong remedy.
  it("does not report an unreadable Stripe key as 'not connected'", () => {
    render(
      <SetupPane
        context={{ ...READY, stripeStatus: "unknown" }}
        onChanged={vi.fn()}
        onOpenStripe={vi.fn()}
      />,
    );
    expect(screen.getByText(/could not be checked/i)).toBeInTheDocument();
    expect(screen.queryByText(/^not connected$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect stripe/i })).not.toBeInTheDocument();
  });

  it("offers Manage rather than Connect once a key is stored", () => {
    render(
      <SetupPane
        context={{ ...READY, stripeStatus: "connected" }}
        onChanged={vi.fn()}
        onOpenStripe={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
  });

  it("surfaces a failed flag write instead of leaving the switch looking flipped", async () => {
    setEcosystemFlag.mockRejectedValue(Object.assign(new Error("nope"), { status: 403 }));
    render(<SetupPane context={READY} onChanged={vi.fn()} onOpenStripe={vi.fn()} />);
    await userEvent.click(screen.getByRole("switch", { name: /sell through this ecosystem/i }));
    expect(await screen.findByText(/nope/i)).toBeInTheDocument();
  });
});
