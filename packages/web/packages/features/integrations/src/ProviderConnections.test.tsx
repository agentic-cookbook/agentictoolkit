// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { ProviderCatalogEntry, SafeConnection } from "@agentic-toolkit/data/integrations";
import { SettingsDirtyProvider, useSettingsDirty } from "@agentic-toolkit/resource";

vi.mock("@agentic-toolkit/auth", () => ({
  reportUnexpectedAuthError: vi.fn(),
}));

// SettingsDirtyProvider mounts its own UnsavedChangesGuard when no rail host is above it, and
// that guard passes onNavigate={(href) => router.push(href)}. There is no app-router context
// under vitest (same mock as settingsDirtyBridge.test.tsx).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { patchSettings } = vi.hoisted(() => ({
  patchSettings: vi.fn(),
}));
vi.mock("@agentic-toolkit/data/integrations", () => ({
  integrationsApi: {
    listConnections: vi.fn(),
    sync: vi.fn(),
    disconnect: vi.fn(),
    patchSettings,
  },
}));

// Not under test here — stub it out so rendering ProviderConnections doesn't also
// have to satisfy ConnectAccountDialog's own (unrelated) wiring.
vi.mock("./ConnectAccountDialog", () => ({
  ConnectAccountDialog: () => null,
}));

import { ProviderConnections } from "./ProviderConnections";

afterEach(cleanup);
beforeEach(() => {
  patchSettings.mockReset();
});

function provider(providerId: string): ProviderCatalogEntry {
  return {
    providerId,
    displayName: providerId,
    subtitle: "",
    description: "",
    links: [],
    authMethod: "oauth",
    serviceTypes: [],
    capabilities: ["read"],
    defaultPollIntervalMs: 0,
  };
}

function connection(providerId: string, syncSettings: Record<string, unknown>): SafeConnection {
  return {
    id: "conn-1",
    provider: providerId,
    serviceType: "",
    status: "active",
    displayName: "Test account",
    username: "",
    externalAccountId: "",
    createdAt: "2026-07-25T00:00:00Z",
    syncSettings,
  };
}

function openSyncSettings() {
  fireEvent.click(screen.getByRole("button", { name: /sync settings/i }));
}

function saveButton() {
  return screen.getByRole("button", { name: "Save sync settings" }) as HTMLButtonElement;
}

describe("ProviderConnections — Gmail sync settings Save is disabled at mount, enabled after an edit", () => {
  const GMAIL = provider("gmail");
  const CONN = connection("gmail", { gmailLabelIds: ["INBOX"], gmailWindowDays: 30 });

  it("is disabled at mount (loaded, unedited)", () => {
    render(
      <ProviderConnections provider={GMAIL} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    expect(saveButton().disabled).toBe(true);
  });

  it("enables once the label ids are edited", () => {
    render(
      <ProviderConnections provider={GMAIL} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Label ids"), { target: { value: "INBOX, IMPORTANT" } });
    expect(saveButton().disabled).toBe(false);
  });

  it("disables again once reverted back to the loaded value", () => {
    render(
      <ProviderConnections provider={GMAIL} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    const labels = screen.getByLabelText("Label ids");
    fireEvent.change(labels, { target: { value: "INBOX, IMPORTANT" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(labels, { target: { value: "INBOX" } });
    expect(saveButton().disabled).toBe(true);
  });

  it("stays disabled on an edit that fails the window-days check, even though it's dirty", () => {
    render(
      <ProviderConnections provider={GMAIL} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("History window (days)"), { target: { value: "0" } });
    expect(saveButton().disabled).toBe(true);
  });

  // The gate makes onSave's own range check unreachable by click, so the message it would have
  // set has to be rendered — otherwise an out-of-range window is just a dead button.
  it("says WHY Save is blocked for an out-of-range window", () => {
    render(
      <ProviderConnections provider={GMAIL} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("History window (days)"), { target: { value: "0" } });
    expect(
      screen.getByText("Window must be a whole number of days between 1 and 366."),
    ).toBeTruthy();
  });

  // The other half of the rule. Prefilled from a STORED value that already fails the range check,
  // so the reason really is non-null at mount — only `dirty` keeps it quiet. (A connection with a
  // valid stored window would pass this test even with the `dirty` term deleted.)
  it("stays silent about an out-of-range STORED window until the user touches it", () => {
    const stale = connection("gmail", { gmailLabelIds: ["INBOX"], gmailWindowDays: 0 });
    render(
      <ProviderConnections provider={GMAIL} ecosystemId="eco-1" providerConfig={null} connections={[stale]} />,
    );
    openSyncSettings();
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByText(/Window must be a whole number/)).toBeNull();
  });

  it("clicking Save while enabled persists, then goes back to disabled (re-baselined)", async () => {
    patchSettings.mockResolvedValue({});
    render(
      <ProviderConnections provider={GMAIL} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Label ids"), { target: { value: "INBOX, IMPORTANT" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(patchSettings).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(saveButton().disabled).toBe(true));
  });
});

describe("ProviderConnections — Reddit sync settings Save is disabled at mount, enabled after an edit", () => {
  const REDDIT = provider("reddit");
  const CONN = connection("reddit", { redditSubreddits: ["typescript"], redditKeywords: ["claude"] });

  it("is disabled at mount (loaded, unedited)", () => {
    render(
      <ProviderConnections provider={REDDIT} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    expect(saveButton().disabled).toBe(true);
  });

  it("enables once the watchlist is edited", () => {
    render(
      <ProviderConnections provider={REDDIT} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Watched subreddits"), {
      target: { value: "typescript, LocalLLaMA" },
    });
    expect(saveButton().disabled).toBe(false);
  });

  it("disables again once reverted back to the loaded value", () => {
    render(
      <ProviderConnections provider={REDDIT} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    const subs = screen.getByLabelText("Watched subreddits");
    fireEvent.change(subs, { target: { value: "typescript, LocalLLaMA" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(subs, { target: { value: "typescript" } });
    expect(saveButton().disabled).toBe(true);
  });

  it("stays disabled on an edit that fails the subreddit-name check, even though it's dirty", () => {
    render(
      <ProviderConnections provider={REDDIT} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Watched subreddits"), { target: { value: "a" } });
    expect(saveButton().disabled).toBe(true);
  });

  // Same reasoning as Gmail's: the gate makes onSave's name check unreachable, and this one names
  // the offending entry — exactly the detail a grey button can't convey.
  it("says WHY Save is blocked, naming the bad entry", () => {
    render(
      <ProviderConnections provider={REDDIT} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Watched subreddits"), { target: { value: "a" } });
    expect(
      screen.getByText('"a" is not a subreddit name (letters, digits, _; 2–21 chars).'),
    ).toBeTruthy();
  });

  it("stays silent about an already-invalid STORED watchlist until the user touches it", () => {
    const stale = connection("reddit", { redditSubreddits: ["a"], redditKeywords: [] });
    render(
      <ProviderConnections provider={REDDIT} ecosystemId="eco-1" providerConfig={null} connections={[stale]} />,
    );
    openSyncSettings();
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByText(/is not a subreddit name/)).toBeNull();
  });

  it("clicking Save while enabled persists, then goes back to disabled (re-baselined)", async () => {
    patchSettings.mockResolvedValue({});
    render(
      <ProviderConnections provider={REDDIT} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Watched subreddits"), {
      target: { value: "typescript, LocalLLaMA" },
    });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(patchSettings).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(saveButton().disabled).toBe(true));
  });
});

describe("ProviderConnections — Mailchimp sync settings Save is disabled at mount, enabled after an edit", () => {
  const MAILCHIMP = provider("mailchimp");
  const CONN = connection("mailchimp", { audienceIds: ["list1"] });

  it("is disabled at mount (loaded, unedited)", () => {
    render(
      <ProviderConnections provider={MAILCHIMP} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    expect(saveButton().disabled).toBe(true);
  });

  it("enables once the audience ids are edited", () => {
    render(
      <ProviderConnections provider={MAILCHIMP} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Audience ids"), { target: { value: "list1, list2" } });
    expect(saveButton().disabled).toBe(false);
  });

  it("disables again once reverted back to the loaded value", () => {
    render(
      <ProviderConnections provider={MAILCHIMP} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    const ids = screen.getByLabelText("Audience ids");
    fireEvent.change(ids, { target: { value: "list1, list2" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(ids, { target: { value: "list1" } });
    expect(saveButton().disabled).toBe(true);
  });

  it("clicking Save while enabled persists, then goes back to disabled (re-baselined)", async () => {
    patchSettings.mockResolvedValue({});
    render(
      <ProviderConnections provider={MAILCHIMP} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Audience ids"), { target: { value: "list1, list2" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(patchSettings).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(saveButton().disabled).toBe(true));
  });
});

describe("ProviderConnections — Klaviyo sync settings Save is disabled at mount, enabled after an edit", () => {
  const KLAVIYO = provider("klaviyo");
  const CONN = connection("klaviyo", { audienceIds: ["list1"] });

  it("is disabled at mount (loaded, unedited)", () => {
    render(
      <ProviderConnections provider={KLAVIYO} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    expect(saveButton().disabled).toBe(true);
  });

  it("enables once the audience ids are edited", () => {
    render(
      <ProviderConnections provider={KLAVIYO} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Audience ids"), { target: { value: "list1, list2" } });
    expect(saveButton().disabled).toBe(false);
  });

  it("disables again once reverted back to the loaded value", () => {
    render(
      <ProviderConnections provider={KLAVIYO} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    const ids = screen.getByLabelText("Audience ids");
    fireEvent.change(ids, { target: { value: "list1, list2" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(ids, { target: { value: "list1" } });
    expect(saveButton().disabled).toBe(true);
  });

  it("clicking Save while enabled persists, then goes back to disabled (re-baselined)", async () => {
    patchSettings.mockResolvedValue({});
    render(
      <ProviderConnections provider={KLAVIYO} ecosystemId="eco-1" providerConfig={null} connections={[CONN]} />,
    );
    openSyncSettings();
    fireEvent.change(screen.getByLabelText("Audience ids"), { target: { value: "list1, list2" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(patchSettings).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(saveButton().disabled).toBe(true));
  });
});

/** Reads the settings registry the way the overlay's close gate does — from an event handler. */
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

function readRegistry() {
  fireEvent.click(screen.getByRole("button", { name: "Read" }));
}

describe("the per-provider sync-settings forms report their unsaved draft to the settings registry", () => {
  const GMAIL = provider("gmail");
  const REDDIT = provider("reddit");

  function renderIn(p: ProviderCatalogEntry, c: SafeConnection) {
    render(
      <SettingsDirtyProvider>
        <DirtyReadout />
        <ProviderConnections provider={p} ecosystemId="eco-1" providerConfig={null} connections={[c]} />
      </SettingsDirtyProvider>,
    );
    openSyncSettings();
  }

  it("stays clean while Gmail's loaded settings are untouched", () => {
    renderIn(GMAIL, connection("gmail", { gmailLabelIds: ["INBOX"], gmailWindowDays: 30 }));
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });

  it("reports dirty once Gmail's label ids are edited", () => {
    renderIn(GMAIL, connection("gmail", { gmailLabelIds: ["INBOX"], gmailWindowDays: 30 }));
    fireEvent.change(screen.getByLabelText("Label ids"), { target: { value: "INBOX, IMPORTANT" } });
    readRegistry();
    expect(screen.getByText("registry sees dirty")).toBeTruthy();
  });

  it("goes clean again when Gmail's edit is reverted to the loaded value", () => {
    renderIn(GMAIL, connection("gmail", { gmailLabelIds: ["INBOX"], gmailWindowDays: 30 }));
    const labels = screen.getByLabelText("Label ids");
    fireEvent.change(labels, { target: { value: "INBOX, IMPORTANT" } });
    fireEvent.change(labels, { target: { value: "INBOX" } });
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });

  it("reports dirty on a Gmail edit Save REFUSES — an invalid draft is still unsaved work", () => {
    renderIn(GMAIL, connection("gmail", { gmailLabelIds: ["INBOX"], gmailWindowDays: 30 }));
    fireEvent.change(screen.getByLabelText("History window (days)"), { target: { value: "0" } });
    expect(saveButton().disabled).toBe(true);
    readRegistry();
    expect(screen.getByText("registry sees dirty")).toBeTruthy();
  });

  it("stays clean while Reddit's loaded settings are untouched", () => {
    renderIn(REDDIT, connection("reddit", { redditSubreddits: ["aww"], redditKeywords: [] }));
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });

  it("reports dirty once Reddit's subreddits are edited", () => {
    renderIn(REDDIT, connection("reddit", { redditSubreddits: ["aww"], redditKeywords: [] }));
    fireEvent.change(screen.getByLabelText("Watched subreddits"), { target: { value: "aww, pics" } });
    readRegistry();
    expect(screen.getByText("registry sees dirty")).toBeTruthy();
  });

  it("withdraws the report when the sync-settings disclosure is collapsed away", () => {
    renderIn(REDDIT, connection("reddit", { redditSubreddits: ["aww"], redditKeywords: [] }));
    fireEvent.change(screen.getByLabelText("Watched subreddits"), { target: { value: "aww, pics" } });
    readRegistry();
    expect(screen.getByText("registry sees dirty")).toBeTruthy();
    // Collapsing unmounts the form and destroys the draft with it — the exit guard must not stay
    // armed for edits that no longer exist anywhere. (`expanded` picks the disclosure TRIGGER;
    // once open, "Save sync settings" matches the same name.)
    fireEvent.click(screen.getByRole("button", { name: /sync settings/i, expanded: true }));
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });
});
