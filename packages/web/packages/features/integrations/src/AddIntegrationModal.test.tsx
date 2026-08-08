// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { MaskedProviderConfig, ProviderCatalogEntry } from "@agentic-toolkit/data/integrations";

// Stub the integrations client so no real network happens. The modal takes its catalog
// via the `providers` prop (the parent calls listProviders), so createProviderConfig is
// the only method the Add flow actually invokes; listProviders is stubbed for parity.
const { createProviderConfig, listProviders } = vi.hoisted(() => ({
  createProviderConfig: vi.fn(),
  listProviders: vi.fn(),
}));
vi.mock("@agentic-toolkit/data/integrations", () => ({
  integrationsApi: { createProviderConfig, listProviders },
}));

import { AddIntegrationModal } from "./AddIntegrationModal";
import { saveDraft } from "./integration-draft-store";
import { intBlank } from "./IntegrationDetail";

// The hub vitest config has no global afterEach; tear each render (+ its portalled
// dialog) down explicitly so it doesn't leak into the next test.
afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  createProviderConfig.mockReset();
  listProviders.mockReset();
});

function mkProvider(over: Partial<ProviderCatalogEntry>): ProviderCatalogEntry {
  return {
    providerId: over.providerId ?? "x",
    displayName: over.displayName ?? "X",
    subtitle: over.subtitle ?? "",
    description: over.description ?? "",
    links: over.links ?? [],
    authMethod: over.authMethod ?? "api_key",
    serviceTypes: over.serviceTypes ?? [],
    capabilities: over.capabilities ?? ["write"],
    defaultPollIntervalMs: over.defaultPollIntervalMs ?? 0,
    configFields: over.configFields,
  };
}

// Deliberately UNSORTED so the alphabetize assertion is meaningful.
const PROVIDERS: ProviderCatalogEntry[] = [
  mkProvider({ providerId: "twilio", displayName: "Twilio", subtitle: "SMS and voice messaging",
    configFields: [{ key: "accountSid", label: "Account SID", secret: false, required: true }] }),
  mkProvider({ providerId: "postmark", displayName: "Postmark", subtitle: "Transactional email" }),
  mkProvider({ providerId: "sendgrid", displayName: "SendGrid", subtitle: "Email delivery" }),
];

const SAVED_ROW: MaskedProviderConfig = {
  id: "cfg-1",
  ecosystemId: "eco-1",
  providerId: "twilio",
  name: "My Twilio",
  rdid: "integration.twilio.cfg-1",
  config: {},
  hasSecret: false,
};

function renderModal(providers: ProviderCatalogEntry[] | null = PROVIDERS) {
  return render(
    <AddIntegrationModal
      open
      onOpenChange={() => {}}
      ecosystemId="eco-1"
      providers={providers}
      onAdded={() => {}}
    />,
  );
}

describe("AddIntegrationModal", () => {
  it("focuses the filter input on open", async () => {
    renderModal();
    const filter = screen.getByLabelText("Filter services");
    await waitFor(() => expect(document.activeElement).toBe(filter));
  });

  it("renders every provider, alphabetized by display name", () => {
    renderModal();
    const names = screen
      .getAllByRole("button")
      .map((b) => b.querySelector("span")?.textContent)
      .filter((t): t is string => t === "Postmark" || t === "SendGrid" || t === "Twilio");
    expect(names).toEqual(["Postmark", "SendGrid", "Twilio"]);
  });

  it("filters by subtitle — typing 'sms' narrows to Twilio only", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Filter services"), { target: { value: "sms" } });
    expect(screen.getByText("Twilio")).toBeTruthy();
    expect(screen.queryByText("Postmark")).toBeNull();
    expect(screen.queryByText("SendGrid")).toBeNull();
  });

  it("adds an integration: select provider, fill fields, click Add → createProviderConfig + 'integration added' + cleared fields", async () => {
    createProviderConfig.mockResolvedValue(SAVED_ROW);
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Twilio/ }));

    const name = screen.getByLabelText("Name") as HTMLInputElement;
    const sid = screen.getByLabelText("Account SID") as HTMLInputElement;
    const addBtn = screen.getByRole("button", { name: /Add Integration/i }) as HTMLButtonElement;

    // Disabled until name + the required field are present.
    expect(addBtn.disabled).toBe(true);
    fireEvent.change(name, { target: { value: "My Twilio" } });
    fireEvent.change(sid, { target: { value: "AC123" } });
    expect(addBtn.disabled).toBe(false);

    fireEvent.click(addBtn);

    await waitFor(() => expect(screen.getByText("integration added")).toBeTruthy());
    expect(createProviderConfig).toHaveBeenCalledTimes(1);
    expect(createProviderConfig).toHaveBeenCalledWith(
      "eco-1",
      expect.objectContaining({ providerId: "twilio", name: "My Twilio" }),
    );
    // Fields cleared so another instance can be added.
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("");
  });

  it("shows the resume banner on open when a draft exists for the ecosystem", () => {
    saveDraft("eco-1", "sendgrid", { ...intBlank("sendgrid"), name: "Draft SendGrid" }, []);
    renderModal();
    expect(screen.getByText(/unfinished integration/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Resume/i })).toBeTruthy();
  });
});
