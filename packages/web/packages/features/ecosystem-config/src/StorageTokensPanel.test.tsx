// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// With no rail host above it, SettingsDirtyProvider mounts its own UnsavedChangesGuard, which
// passes onNavigate={(href) => router.push(href)}. There is no app-router context under vitest.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Mocked at the tokenPrincipalsApi boundary so the real useQuery/useMutation wiring — cache keys,
// invalidation, pending state, the onSuccess that clears the form — all runs; only the network
// call is stubbed.
const { list, mint, revoke } = vi.hoisted(() => ({
  list: vi.fn(),
  mint: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("@agentic-toolkit/data/ecosystem-config", () => ({ tokenPrincipalsApi: { list, mint, revoke } }));

import { StorageTokensPanel } from "./StorageTokensPanel";
import { SettingsDirtyProvider, useSettingsDirty } from "@agentic-toolkit/resource";

// This vitest config has no auto-cleanup setup file, so each render must be torn down explicitly
// or the next test's queries see BOTH mounted trees.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  list.mockResolvedValue([]);
  mint.mockResolvedValue({ token: "adh_secret", id: "t1" });
});

/** Reads the registry the way the exit gates do — from an event handler, not render. */
function DirtyReadout() {
  const { isAnyDirty } = useSettingsDirty();
  const [seen, setSeen] = useState<string | null>(null);
  return (
    <div>
      <button type="button" onClick={() => setSeen(isAnyDirty() ? "dirty" : "clean")}>
        Read
      </button>
      {seen && <p>registry sees {seen}</p>}
    </div>
  );
}

// ── the unguarded mint form ───────────────────────────────────────────────────────────────
// The panel is a workspace-rail feature and a per-product topic, both under the chrome that
// mounts a SettingsDirtyProvider. A typed-but-unminted token name, description and expiry were
// discarded in silence on a rail switch, a breadcrumb, a link click or a reload.
describe("TokensPanel reports its unminted token to the settings registry", () => {
  function renderPanel(props: { ecosystemId?: string; workspace?: string } = {}) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <SettingsDirtyProvider>
          <DirtyReadout />
          {children}
        </SettingsDirtyProvider>
      </QueryClientProvider>
    );
    return render(<StorageTokensPanel {...props} />, { wrapper });
  }

  const readRegistry = () => fireEvent.click(screen.getByRole("button", { name: "Read" }));
  const expectRegistry = (state: "dirty" | "clean") =>
    expect(screen.getByText(`registry sees ${state}`)).toBeTruthy();

  it("stays clean while the mint form is untouched", async () => {
    renderPanel();
    await screen.findByText("No tokens yet.");
    readRegistry();
    expectRegistry("clean");
  });

  it("reports dirty once a token name is typed", async () => {
    renderPanel();
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "ci-sync" } });
    readRegistry();
    expectRegistry("dirty");
  });

  // The description alone is still work to lose: the name is not the only thing the operator
  // typed, and a guard keyed only to the name would drop the rest without a word.
  it("reports dirty on the description alone", async () => {
    renderPanel();
    await screen.findByLabelText("Name");
    fireEvent.change(screen.getByLabelText("Description (optional)"), {
      target: { value: "nightly export job" },
    });
    readRegistry();
    expectRegistry("dirty");
  });

  it("goes clean again when the fields are cleared", async () => {
    renderPanel();
    const name = await screen.findByLabelText("Name");
    fireEvent.change(name, { target: { value: "ci-sync" } });
    fireEvent.change(name, { target: { value: "" } });
    readRegistry();
    expectRegistry("clean");
  });

  // Whitespace is what Create itself refuses (`!leaf.trim()` disables it), so a guard that fired
  // on it would prompt over something the form would not even submit.
  it("treats a whitespace-only name as clean", async () => {
    renderPanel();
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "   " } });
    readRegistry();
    expectRegistry("clean");
  });

  // The revealed secret is deliberately NOT dirt. It is shown once and copied, not edited — a
  // guard on it would prompt on the way out of a mint that already succeeded.
  it("withdraws the report once the token is minted, secret on screen and all", async () => {
    renderPanel();
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "ci-sync" } });
    fireEvent.click(screen.getByRole("button", { name: "Create token" }));

    await waitFor(() => expect(screen.getByText(/copy now — shown once/i)).toBeTruthy());
    readRegistry();
    expectRegistry("clean");
  });

  // Two scopes are two different drafts, so they key separately — otherwise the second panel's
  // report overwrites the first's and one clean form withdraws the other's dirt.
  it("keys the report by scope, so a product topic and the rail panel do not share one", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <SettingsDirtyProvider>
          <DirtyReadout />
          <StorageTokensPanel />
          <StorageTokensPanel ecosystemId="eco1" />
        </SettingsDirtyProvider>
      </QueryClientProvider>,
    );

    const names = await screen.findAllByLabelText("Name");
    expect(names).toHaveLength(2);
    // Both dirty first, then the FIRST goes clean while the second still holds a draft. Under one
    // shared key that withdrawal deletes the only entry and the live draft becomes invisible; the
    // order matters, because clearing before the other typed would end dirty either way.
    fireEvent.change(names[0]!, { target: { value: "ci-sync" } });
    fireEvent.change(names[1]!, { target: { value: "nightly" } });
    fireEvent.change(names[0]!, { target: { value: "" } });
    readRegistry();
    expectRegistry("dirty");
  });
});
