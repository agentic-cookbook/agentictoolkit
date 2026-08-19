import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setEcosystemFlag = vi.fn();
vi.mock("../api/feature-flags", () => ({ setEcosystemFlag: (...a: unknown[]) => setEcosystemFlag(...a) }));

import { SetupPane } from "../SetupPane";

const READY = {
  ecosystemId: "eco_1", billingEnabled: false, canManage: true,
  stripeConnected: false, webhookPath: "/api/public/webhooks/stripe/eco_1", isError: false,
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

  it("surfaces a failed flag write instead of leaving the switch looking flipped", async () => {
    setEcosystemFlag.mockRejectedValue(Object.assign(new Error("nope"), { status: 403 }));
    render(<SetupPane context={READY} onChanged={vi.fn()} onOpenStripe={vi.fn()} />);
    await userEvent.click(screen.getByRole("switch", { name: /sell through this ecosystem/i }));
    expect(await screen.findByText(/nope/i)).toBeInTheDocument();
  });
});
