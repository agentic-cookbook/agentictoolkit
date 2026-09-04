// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { MaskedProviderConfig, ProviderCatalogEntry } from "@agentic-toolkit/data/integrations";

/**
 * The GitHub App path through the integrations feature, end to end as the operator walks
 * it: save the APP (its id and private key) on the ecosystem, then connect an INSTALLATION
 * of it by being sent to GitHub.
 *
 * Both halves have failed silently before. The credentials form is chosen by shape, not by
 * name — a provider that declares any `configFields` gets the api_key editor instead — so
 * one plausible-looking line in the catalog is enough to make the app id and private key
 * have no surface anywhere, which is exactly what happened. And the connect step's whole
 * job is to leave: what it must get right is not what it renders but the state it stashes
 * before the browser goes, because that stash is the only thing the callback route has to
 * work out what it is finishing.
 *
 * shipr's pushes are the server's, made with an installation token minted from that private
 * key, so "GitHub is connected" is the load-bearing precondition of every run.
 */

// PARTIAL: a factory returning a bare object replaces the whole module, and this package reads
// `currentReturnTo` and `safeReturnTo` from it too — both on the path this file exercises, since
// stashing a pending connect captures the address to come back to. Stubbing the module flat left
// those undefined, which surfaced as an empty stash rather than as a missing mock.
vi.mock("@agentic-toolkit/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agentic-toolkit/auth")>();
  return { ...actual, reportUnexpectedAuthError: vi.fn() };
});

const { getInstallUrl, updateProviderConfig, createProviderConfig } = vi.hoisted(() => ({
  getInstallUrl: vi.fn(),
  updateProviderConfig: vi.fn(),
  createProviderConfig: vi.fn(),
}));
vi.mock("@agentic-toolkit/data/integrations", () => ({
  integrationsApi: { getInstallUrl, updateProviderConfig, createProviderConfig },
  oauthCallbackUrl: () => "https://app.example.test/integrations/oauth-callback",
}));

import { ConnectAccountDialog } from "./ConnectAccountDialog";
import { IntegrationDetailView } from "./IntegrationDetailView";
import { intToInput, type IntegrationInput } from "./IntegrationDetail";
import { readPendingConnect } from "./oauth-callback-store";

// The hub vitest config has no global afterEach; tear each render (+ its portalled dialog)
// down explicitly so it doesn't leak into the next test.
afterEach(cleanup);
afterEach(() => {
  restoreLocation?.();
  restoreLocation = null;
});
beforeEach(() => {
  getInstallUrl.mockReset();
  sessionStorage.clear();
});

let restoreLocation: (() => void) | null = null;

/**
 * Somewhere for the browser to go.
 *
 * jsdom's `Location` will not have `assign` replaced on it, so the whole `window.location`
 * property is swapped for the duration of a test — the same trick the auth package's
 * LoginCard test uses. `pathname` is fixed here because the dialog reads it as the
 * `returnTo` it stashes.
 */
const RETURN_TO = "/settings/integrations";

function captureNavigation(): string[] {
  const original = window.location;
  const assigned: string[] = [];
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...original,
      pathname: RETURN_TO,
      assign: (url: string) => {
        assigned.push(url);
      },
    },
  });
  restoreLocation = () =>
    Object.defineProperty(window, "location", { configurable: true, value: original });
  return assigned;
}

/**
 * The catalog's own entry for `github-app`, trimmed to what these components read.
 *
 * `configFields` is ABSENT, and that absence is the fixture's whole point: an installation
 * id is a fact about a connection, not about the ecosystem's config, and declaring one here
 * flips `hasConfigFields` and hands the whole form to the api_key editor.
 */
const GITHUB_APP: ProviderCatalogEntry = {
  providerId: "github-app",
  displayName: "GitHub App",
  subtitle: "Code",
  description: "",
  links: [],
  authMethod: "github_app",
  serviceTypes: ["code"],
  capabilities: ["read", "write"],
  defaultPollIntervalMs: 3_600_000,
};

const SAVED: MaskedProviderConfig = {
  id: "cfg-1",
  ecosystemId: "eco-1",
  providerId: "github-app",
  name: "ADH deploys",
  rdid: "integration.github-app.cfg-1",
  config: { clientId: "123456" },
  hasSecret: true,
};

/** Mirrors how IntegrationsPane wires the shared view in mode='saved'. */
function SavedForm({
  provider = GITHUB_APP,
  config = SAVED,
}: {
  provider?: ProviderCatalogEntry;
  config?: MaskedProviderConfig;
}) {
  const [draft, setDraft] = useState<IntegrationInput>(() => intToInput(config, provider));
  return (
    <IntegrationDetailView
      provider={provider}
      ecosystemId="eco-1"
      mode="saved"
      config={config}
      draft={draft}
      onChange={setDraft}
      onSaved={(row) => setDraft(intToInput(row, provider))}
    />
  );
}

describe("the ecosystem credentials form for a GitHub App", () => {
  it("asks for an app id and a private key, in those words", () => {
    render(<SavedForm />);
    // "Client ID" and "Client secret" are the OAuth pair. An operator handed those labels
    // has no way to tell whether the thing they are holding is the right credential.
    expect(screen.getByLabelText("App ID")).toBeTruthy();
    expect(screen.getByLabelText("Private key")).toBeTruthy();
    expect(screen.queryByLabelText("Client ID")).toBeNull();
    expect(screen.queryByLabelText("Client secret")).toBeNull();
  });

  it("gives the private key a field a PEM actually fits in", () => {
    render(<SavedForm />);
    const key = screen.getByLabelText("Private key");
    // A one-line password input visibly refuses the newlines in a 25-line .pem, and the
    // paste that half-works is unverifiable afterwards — nothing is ever shown back.
    expect(key.tagName).toBe("TEXTAREA");
    // Still write-only: what is stored comes back as `hasSecret`, never as the key.
    expect(key.getAttribute("value")).toBeNull();
    expect((key as HTMLTextAreaElement).value).toBe("");
  });

  it("offers neither scopes nor the endpoint overrides", () => {
    render(<SavedForm />);
    // An app's permissions live ON the app, chosen when it was registered; the endpoint
    // overrides only mean something to an OAuth token exchange. Both would be controls
    // whose value is silently discarded.
    expect(screen.queryByLabelText("Scopes")).toBeNull();
    expect(screen.queryByText("Advanced")).toBeNull();
  });

  it("names the field that is on the screen when it is empty", async () => {
    // The refusal has to be actionable. "Client ID is required" over an empty box labelled
    // "App ID" reads as a form complaining about a field that isn't there.
    render(<SavedForm config={{ ...SAVED, config: {} }} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "ADH deploys 2" } });
    expect(await screen.findByText("App ID is required.")).toBeTruthy();
  });

  it("would lose both fields if the catalog declared a config field", () => {
    // The regression, stated as the mechanism rather than as a memory: `hasConfigFields`
    // takes precedence over the auth method, so ONE declared field replaces the whole
    // credentials form with the spec-driven editor — and the app id and private key then
    // have no surface anywhere in the product.
    render(
      <SavedForm
        provider={{
          ...GITHUB_APP,
          configFields: [{ key: "installationId", label: "Installation ID", secret: false }],
        }}
      />,
    );
    expect(screen.getByLabelText("Installation ID")).toBeTruthy();
    expect(screen.queryByLabelText("App ID")).toBeNull();
    expect(screen.queryByLabelText("Private key")).toBeNull();
  });
});

function connectDialog(providerConfig: MaskedProviderConfig | null) {
  return render(
    <ConnectAccountDialog
      provider={GITHUB_APP}
      ecosystemId="eco-1"
      providerConfig={providerConfig}
      open
      onOpenChange={() => {}}
      onConnected={() => {}}
    />,
  );
}

describe("connecting an installation", () => {
  it("sends the installer to GitHub rather than asking them for anything", () => {
    connectDialog(SAVED);
    // No credential entry here at all, by design: the account and the repositories are
    // picked on GitHub's own installation page, which is the picker we would otherwise be
    // rebuilding — and which is the only place that selection can actually be made.
    expect(screen.getByRole("button", { name: "Continue to GitHub App" })).toBeTruthy();
    expect(screen.getByText(/choose the account to install on/)).toBeTruthy();
    expect(screen.getByText(/Nothing is connected until you finish there/)).toBeTruthy();
  });

  it("stashes what the callback route needs before it hands the browser over", async () => {
    const assigned = captureNavigation();
    getInstallUrl.mockResolvedValue({
      url: "https://github.test/apps/adh/installations/new?state=st-1",
      state: "st-1",
    });

    connectDialog(SAVED);
    fireEvent.click(screen.getByRole("button", { name: "Continue to GitHub App" }));

    await waitFor(() => expect(assigned).toHaveLength(1));
    expect(getInstallUrl).toHaveBeenCalledWith("github-app", {
      ecosystemId: "eco-1",
      serviceType: "code",
    });
    // The page is about to leave, and it comes back to a route that knows nothing except
    // the state in the URL. Everything the finish needs is stashed under that state first
    // — an assign that ran before the stash returns to a callback that cannot finish.
    expect(assigned[0]).toBe("https://github.test/apps/adh/installations/new?state=st-1");
    expect(readPendingConnect("st-1")).toEqual({
      authMethod: "github_app",
      providerId: "github-app",
      serviceType: "code",
      ecosystemId: "eco-1",
      returnTo: RETURN_TO,
    });
  });

  it("carries no redirect_uri, because the app owns where it returns to", async () => {
    const assigned = captureNavigation();
    getInstallUrl.mockResolvedValue({ url: "https://github.test/install", state: "st-2" });

    connectDialog(SAVED);
    fireEvent.click(screen.getByRole("button", { name: "Continue to GitHub App" }));
    await waitFor(() => expect(assigned).toHaveLength(1));

    // An installation returns to the setup URL configured ON the app; a redirect_uri sent
    // from here is at best ignored and at worst a mismatch GitHub refuses.
    expect(getInstallUrl.mock.calls[0]?.[1]).not.toHaveProperty("redirectUri");
    expect(readPendingConnect("st-2")).not.toHaveProperty("redirectUri");
  });

  it("refuses to start when no app has been saved yet", () => {
    // The install URL is built from the app's own id and private key, so with no config
    // saved there is not even a page to send the installer to. Said here rather than
    // discovered as an opaque failure one click later.
    connectDialog(null);
    expect(screen.queryByRole("button", { name: "Continue to GitHub App" })).toBeNull();
    expect(screen.getByText(/Save this integration's client configuration first/)).toBeTruthy();
    expect(getInstallUrl).not.toHaveBeenCalled();
  });

  it("says so plainly when the forge refuses, and stays where it is", async () => {
    const assigned = captureNavigation();
    getInstallUrl.mockRejectedValue(new Error("app not found"));

    connectDialog(SAVED);
    fireEvent.click(screen.getByRole("button", { name: "Continue to GitHub App" }));

    expect(await screen.findByText("app not found")).toBeTruthy();
    // Nothing was stashed and nothing navigated, so the button is simply clickable again.
    expect(assigned).toEqual([]);
    expect(
      (screen.getByRole("button", { name: "Continue to GitHub App" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
