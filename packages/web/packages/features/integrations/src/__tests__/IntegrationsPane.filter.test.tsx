import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RailHostBoundary } from "@agentic-toolkit/resource";

const listProviderConfigs = vi.fn();
const listProviders = vi.fn();
vi.mock("@agentic-toolkit/data/integrations", () => ({
  integrationsApi: {
    listProviderConfigs: (...a: unknown[]) => listProviderConfigs(...a),
    listProviders: (...a: unknown[]) => listProviders(...a),
    getProviderConfigById: vi.fn(async () => null),
  },
}));

// The add modal is the SECOND derived value under test. Stubbed so the assertion is on the
// `providers` array it is HANDED — the real modal computes its own `visible` from that array,
// so filtering upstream is the whole mechanism and this is the seam where it shows.
const modalProviders = vi.fn();
vi.mock("../AddIntegrationModal", () => ({
  AddIntegrationModal: (p: { providers: unknown[] | null }) => {
    modalProviders(p.providers);
    return null;
  },
}));

import { IntegrationsPane } from "../IntegrationsPane";

const CATALOG = [
  { providerId: "stripe", displayName: "Stripe", subtitle: "Billing", serviceTypes: ["billing"] },
  { providerId: "postmark", displayName: "Postmark", subtitle: "Email", serviceTypes: ["email"] },
];
const CONFIGS = [
  { id: "c1", rdid: null, ecosystemId: "e1", providerId: "stripe", name: "Stripe live", config: {}, hasSecret: true },
  { id: "c2", rdid: null, ecosystemId: "e1", providerId: "postmark", name: "Postmark", config: {}, hasSecret: true },
];

describe("IntegrationsPane providerIds", () => {
  it("lists only the named providers' rows, and offers only them in the add modal", async () => {
    listProviders.mockResolvedValue(CATALOG);
    listProviderConfigs.mockResolvedValue(CONFIGS);

    // Wrapped in RailHostBoundary: the pane publishes its rows through `useMasterDetailLevel`
    // into a rail host, so a bare `render` has no host to paint the row labels into.
    render(
      <RailHostBoundary>
        <IntegrationsPane ecosystemId="e1" providerIds={["stripe"]} levelTitle="Stripe" />
      </RailHostBoundary>,
    );

    expect(await screen.findByText("Stripe live")).toBeInTheDocument();
    expect(screen.queryByText("Postmark")).not.toBeInTheDocument();

    const handed = modalProviders.mock.calls.at(-1)?.[0] as { providerId: string }[] | null;
    expect(handed?.map((p) => p.providerId)).toEqual(["stripe"]);
  });

  it("lists the whole catalog when providerIds is omitted", async () => {
    listProviders.mockResolvedValue(CATALOG);
    listProviderConfigs.mockResolvedValue(CONFIGS);

    render(
      <RailHostBoundary>
        <IntegrationsPane ecosystemId="e1" />
      </RailHostBoundary>,
    );

    expect(await screen.findByText("Stripe live")).toBeInTheDocument();
    expect(await screen.findByText("Postmark")).toBeInTheDocument();
  });
});
