// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// With no rail host above it, SettingsDirtyProvider mounts its own UnsavedChangesGuard, which
// passes onNavigate={(href) => router.push(href)}. There is no app-router context under vitest.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// Mocked at the transport, not the hooks: `useMessagingStatus` / `useMessagingTemplates` /
// `useSendMessage` — their cache keys, their `enabled` gating, the reset-on-success — all run
// for real, which is what makes "the fields cleared, so the report withdrew" a real assertion.
const { authedJson } = vi.hoisted(() => ({ authedJson: vi.fn() }));
// The transport is `@agentic-toolkit/auth/client` directly now that this pane and its
// client live in a package: the hub's `@/api/http` was only ever a re-export of it, so
// mocking that barrel and mocking this module were always the same interception.
vi.mock("@agentic-toolkit/auth/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/auth/client")>()),
  authedJson,
}));

import { SettingsDirtyProvider, useSettingsDirty } from "@agentic-toolkit/resource";
import { MessagingPane } from "./MessagingPane";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TEMPLATE = {
  id: "tpl-1",
  name: "Welcome",
  subject: "Welcome, {{name}}",
  htmlBody: "<p>Hi {{name}}</p>",
  textBody: "Hi {{name}}",
  smsBody: null,
};

beforeEach(() => {
  // One stub for every route the pane touches, keyed by URL — the pane fires status, templates
  // and log concurrently on mount, so a single mockResolvedValue would feed all three the same
  // body and the log table would try to page over a status object.
  authedJson.mockImplementation((url: string) => {
    if (url.endsWith("/status")) return Promise.resolve({ email: true, sms: true });
    if (url.endsWith("/messaging/templates")) return Promise.resolve([TEMPLATE]);
    if (url.includes("/log")) return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20 });
    return Promise.resolve({ ok: true });
  });
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

function renderPane() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsDirtyProvider>
        <DirtyReadout />
        <MessagingPane ecosystemId="eco-1" />
      </SettingsDirtyProvider>
    </QueryClientProvider>,
  );
}

/** Waits for the templates query before choosing — setting a `<select>` to a value whose
 *  `<option>` has not rendered yet leaves it on "" and the variable fields never appear. */
async function selectTemplate() {
  await screen.findByRole("option", { name: TEMPLATE.name });
  fireEvent.change(screen.getByLabelText("Content"), { target: { value: TEMPLATE.id } });
}

const readRegistry = () => fireEvent.click(screen.getByRole("button", { name: "Read" }));
const expectRegistry = (state: "dirty" | "clean") =>
  expect(screen.getByText(`registry sees ${state}`)).toBeTruthy();

// The pane renders under `/[workspace]/products/…`, whose WorkspaceChromeProvider mounts a
// SettingsDirtyProvider for the whole subtree. A half-composed message to a customer is exactly
// the kind of work a rail switch, a breadcrumb, a link click or a reload used to discard in
// silence — this form reported nothing, so all four went through without a word.
describe("MessagingPane's send form reports its unsent draft to the settings registry", () => {
  it("stays clean on an untouched form", async () => {
    renderPane();
    await screen.findByLabelText("Customer ID");
    readRegistry();
    expectRegistry("clean");
  });

  it("reports dirty once a message body is typed", async () => {
    renderPane();
    fireEvent.change(await screen.findByLabelText("Message body"), {
      target: { value: "Your order shipped" },
    });
    readRegistry();
    expectRegistry("dirty");
  });

  it("reports dirty once a recipient is entered", async () => {
    renderPane();
    fireEvent.change(await screen.findByLabelText(/Recipient override/), {
      target: { value: "bob@example.com" },
    });
    readRegistry();
    expectRegistry("dirty");
  });

  it("goes clean again when the typed text is cleared", async () => {
    renderPane();
    const body = await screen.findByLabelText("Message body");
    fireEvent.change(body, { target: { value: "Your order shipped" } });
    fireEvent.change(body, { target: { value: "" } });
    readRegistry();
    expectRegistry("clean");
  });

  // Whitespace is not a draft. Reporting it dirty would nag over a stray space bar, which is the
  // "fires when nothing changed" failure the hook's own doc warns is worse than no prompt at all.
  it("treats whitespace-only input as clean", async () => {
    renderPane();
    fireEvent.change(await screen.findByLabelText("Message body"), { target: { value: "   " } });
    readRegistry();
    expectRegistry("clean");
  });

  // Both are one-click selections with defaults: switching channel or picking a template loses
  // nothing the user typed, so arming the guard on them would nag on a free exit.
  it("stays clean when only the channel or the template is chosen", async () => {
    renderPane();
    fireEvent.change(await screen.findByLabelText("Channel"), { target: { value: "sms" } });
    await selectTemplate();
    readRegistry();
    expectRegistry("clean");
  });

  // A chosen template's variables ARE typed work, and they live in a different piece of state
  // (`vars`) than the freeform fields — covered separately because the freeform assertions above
  // pass whether or not `vars` is in the diff.
  it("reports dirty once a chosen template's variables are filled in", async () => {
    renderPane();
    await selectTemplate();
    fireEvent.change(await screen.findByLabelText("name"), { target: { value: "Bob" } });
    readRegistry();
    expectRegistry("dirty");
  });

  // Picking a template hides the freeform fields AND drops them from the payload — `handleSend`
  // sends `templateVars` instead. Text stranded behind that switch is invisible and unsendable, so
  // a guard still holding it would prompt about work that is nowhere on screen.
  it("stops reporting freeform text that a template switch put out of reach", async () => {
    renderPane();
    fireEvent.change(await screen.findByLabelText("Message body"), {
      target: { value: "Your order shipped" },
    });
    readRegistry();
    expectRegistry("dirty");

    await selectTemplate();
    // Gone from the DOM, gone from the payload — and now gone from the report.
    expect(screen.queryByLabelText("Message body")).toBeNull();
    readRegistry();
    expectRegistry("clean");
  });

  // The draft is not CLEARED by the switch, only unreported — switching back must bring it with it,
  // or the guard would have quietly become a data-loss bug of its own.
  it("reports the freeform draft again when the template is switched back off", async () => {
    renderPane();
    fireEvent.change(await screen.findByLabelText("Message body"), {
      target: { value: "Your order shipped" },
    });
    await selectTemplate();
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "" } });

    expect((screen.getByLabelText("Message body") as HTMLTextAreaElement).value).toBe(
      "Your order shipped",
    );
    readRegistry();
    expectRegistry("dirty");
  });

  // Same shape one level down: `handleSend` sends the subject only for email, and the field is
  // rendered only for email, so a subject stranded on SMS is the same invisible-and-unsendable text.
  it("stops reporting a subject that a switch to SMS put out of reach", async () => {
    renderPane();
    fireEvent.change(await screen.findByLabelText("Subject"), { target: { value: "Shipped" } });
    readRegistry();
    expectRegistry("dirty");

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "sms" } });
    expect(screen.queryByLabelText("Subject")).toBeNull();
    readRegistry();
    expectRegistry("clean");
  });

  it("withdraws the report once the message actually sends", async () => {
    renderPane();
    fireEvent.change(await screen.findByLabelText("Customer ID"), { target: { value: "cust-1" } });
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Shipped" } });
    fireEvent.change(screen.getByLabelText("Message body"), { target: { value: "On its way" } });
    readRegistry();
    expectRegistry("dirty");

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    // `reset` runs on success only, so the guard must disarm on the same signal the form clears on.
    await waitFor(() =>
      expect((screen.getByLabelText("Message body") as HTMLTextAreaElement).value).toBe(""),
    );
    readRegistry();
    expectRegistry("clean");
  });
});
