// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// With no rail host above it, SettingsDirtyProvider mounts its own UnsavedChangesGuard, which
// passes onNavigate={(href) => router.push(href)}. There is no app-router context under vitest.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Mocked at the organizationsApi boundary so the real useAction wiring — busy, error, the
// onCreated hand-off — runs; only the network call is stubbed.
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@agentic-toolkit/data/organizations", () => ({ organizationsApi: { create } }));

import { NewOrganizationModal } from "./NewOrganizationModal";
import { SettingsDirtyProvider, useSettingsDirty } from "@agentic-toolkit/resource";

// This vitest config has no auto-cleanup setup file, so each render must be torn down explicitly
// or the next test's queries see BOTH mounted trees.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  create.mockResolvedValue({ organization: { slug: "acme" } });
});

// The workspace the dialog was opened FROM, and therefore the one that will own what it creates.
// Required by the component for the same reason it is required by the API: an org created inside
// an org workspace and posted without it silently becomes the creator's personal org.
const OWNER = "owning-workspace";

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

// ── the unguarded create dialog ───────────────────────────────────────────────────────────
// The modal opens from bare `/home`, which had no dirty registry at all until `app/home/layout`
// mounted one — so a half-entered org (a slug that had to pass validateLeaf, and is permanent
// once provisioned) was discarded in silence by every exit.
describe("NewOrganizationModal reports its half-entered org to the settings registry", () => {
  function renderModal(open = true) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SettingsDirtyProvider>
        <DirtyReadout />
        {children}
      </SettingsDirtyProvider>
    );
    return render(
      <NewOrganizationModal
        open={open}
        workspaceSlug={OWNER}
        onClose={() => {}}
        onCreated={() => {}}
      />,
      { wrapper },
    );
  }

  // By TEXT, not by role: an open base-ui dialog marks everything outside the popup inert and
  // aria-hidden, so the readout button is off the accessibility tree while the modal is up and
  // `getByRole` cannot see it. jsdom does not implement `inert`, so the click still lands.
  const readRegistry = () => fireEvent.click(screen.getByText("Read"));
  const expectRegistry = (state: "dirty" | "clean") =>
    expect(screen.getByText(`registry sees ${state}`)).toBeTruthy();

  it("stays clean while the open dialog is untouched", async () => {
    renderModal();
    await screen.findByLabelText("slug *");
    readRegistry();
    expectRegistry("clean");
  });

  it("reports dirty once a slug is typed", async () => {
    renderModal();
    fireEvent.change(await screen.findByLabelText("slug *"), { target: { value: "acme" } });
    readRegistry();
    expectRegistry("dirty");
  });

  // The name alone counts too: a slug typed and then cleared while the name stands is still work
  // on screen, and a guard keyed only to the slug would drop it.
  it("reports dirty on the name alone", async () => {
    renderModal();
    await screen.findByLabelText("slug *");
    fireEvent.change(screen.getByLabelText("name *"), { target: { value: "Acme Inc." } });
    readRegistry();
    expectRegistry("dirty");
  });

  it("goes clean again when the fields are cleared", async () => {
    renderModal();
    const slug = await screen.findByLabelText("slug *");
    fireEvent.change(slug, { target: { value: "acme" } });
    fireEvent.change(slug, { target: { value: "" } });
    readRegistry();
    expectRegistry("clean");
  });

  // The whole reason the report is gated on `open`: this component stays MOUNTED with its state
  // intact when the dialog closes, so an ungated report would keep the guard armed over text
  // nobody can see and prompt on a navigation minutes later.
  it("withdraws the report when the dialog is closed with the fields still filled", async () => {
    const { rerender } = renderModal();
    fireEvent.change(await screen.findByLabelText("slug *"), { target: { value: "acme" } });
    readRegistry();
    expectRegistry("dirty");

    // Only the modal: RTL re-applies the `wrapper` itself, and passing the provider again here
    // would mount a SECOND readout beside the first.
    rerender(
      <NewOrganizationModal
        open={false}
        workspaceSlug={OWNER}
        onClose={() => {}}
        onCreated={() => {}}
      />,
    );
    readRegistry();
    expectRegistry("clean");
  });

  it("withdraws the report once the organization is created", async () => {
    const onCreated = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SettingsDirtyProvider>
        <DirtyReadout />
        {children}
      </SettingsDirtyProvider>
    );
    const { rerender } = render(
      <NewOrganizationModal open workspaceSlug={OWNER} onClose={() => {}} onCreated={onCreated} />,
      { wrapper },
    );

    fireEvent.change(await screen.findByLabelText("slug *"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("name *"), { target: { value: "Acme Inc." } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    // The caller closes the dialog off the back of onCreated — that hand-off is what ends the
    // draft, so assert it happened and then that the closed modal reports nothing.
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("acme"));
    // The owning workspace reaches the wire — the prop is not decoration.
    expect(create).toHaveBeenCalledWith({ slug: "acme", name: "Acme Inc." }, OWNER);
    rerender(
      <NewOrganizationModal
        open={false}
        workspaceSlug={OWNER}
        onClose={() => {}}
        onCreated={onCreated}
      />,
    );
    readRegistry();
    expectRegistry("clean");
  });
});
