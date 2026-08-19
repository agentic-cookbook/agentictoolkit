import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RailHostBoundary } from "@agentic-toolkit/resource";

const listProviderConfigs = vi.fn();
const listProviders = vi.fn();
const getProviderConfigById = vi.fn(async () => null as unknown);
vi.mock("@agentic-toolkit/data/integrations", () => ({
  integrationsApi: {
    listProviderConfigs: (...a: unknown[]) => listProviderConfigs(...a),
    listProviders: (...a: unknown[]) => listProviders(...a),
    getProviderConfigById: (...a: unknown[]) => getProviderConfigById(...(a as [])),
  },
}));

// The saved-instance detail is stubbed: this file is about WHICH row the pane resolves, not about
// the credential form's own fields. The stub reports the config it was handed so the assertion can
// name the row rather than settling for "something rendered".
vi.mock("../IntegrationDetailView", () => ({
  IntegrationDetailView: ({ config }: { config: { name: string } }) => (
    <div data-testid="detail">{config.name}</div>
  ),
}));
vi.mock("../AddIntegrationModal", () => ({ AddIntegrationModal: () => null }));

import { IntegrationsPane } from "../IntegrationsPane";

const CATALOG = [
  { providerId: "stripe", displayName: "Stripe", subtitle: "Billing", serviceTypes: ["billing"] },
];
const CONFIGS = [
  {
    id: "c1",
    rdid: null,
    ecosystemId: "e1",
    providerId: "stripe",
    name: "Stripe live",
    config: {},
    hasSecret: true,
  },
];

/**
 * Selection with NO `leaf` — the mount every host that cedes no URL segment below the topic uses:
 * the hub's workspace rail and the products topic, both of which reach this pane through
 * `BillingGroup`'s Stripe member.
 *
 * The pane runs two selection mechanisms — its own derived `cfg`, and `useMasterDetailForm`'s
 * internal dual-mode state — and they used to read from different places: the derived side read
 * `leaf?.leafId`, which is permanently `null` here, while the form held the real selection. The
 * rail highlighted the clicked row (it renders `form.selectedId`) and the pane body below it
 * stayed on the select nudge. Nothing typechecked wrong and no test rendered this mount and then
 * clicked, which is how it survived a whole branch.
 */
describe("IntegrationsPane selection without a URL leaf", () => {
  it("opens a row's detail when the rail row is clicked", async () => {
    listProviders.mockResolvedValue(CATALOG);
    listProviderConfigs.mockResolvedValue(CONFIGS);

    render(
      <RailHostBoundary>
        <IntegrationsPane ecosystemId="e1" providerIds={["stripe"]} levelTitle="Stripe" />
      </RailHostBoundary>,
    );

    await userEvent.click(await screen.findByRole("button", { name: /Stripe live/ }));
    // The detail, and the pane's own destructive control that lives beside it — both are inside
    // the single `cfg && provider && form.draft` branch that was unreachable here.
    expect(await screen.findByTestId("detail")).toHaveTextContent("Stripe live");
    expect(screen.getByRole("button", { name: /remove integration/i })).toBeInTheDocument();
  });

  // The other direction, so the fix cannot be "ignore the leaf": a host that DOES cede the
  // segment must still deep-link straight into a row without a click.
  it("still opens the row named by the leaf when one is given", async () => {
    listProviders.mockResolvedValue(CATALOG);
    listProviderConfigs.mockResolvedValue(CONFIGS);

    render(
      <RailHostBoundary>
        <IntegrationsPane
          ecosystemId="e1"
          providerIds={["stripe"]}
          leaf={{ leafId: "c1", onSelect: vi.fn() }}
        />
      </RailHostBoundary>,
    );

    expect(await screen.findByTestId("detail")).toHaveTextContent("Stripe live");
  });
});
