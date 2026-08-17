// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfilePanel, type ProfilePanelProps } from "./ProfilePanel";
import { listContacts } from "../api/account";
import { listSocialLinks, listAddresses, getPrivacyGrants } from "@agentic-toolkit/data/profile";
import type { Me } from "../api/auth";

// Unlike the admin dialogs (which call their mutation hooks internally behind a
// mockable module boundary), ProfilePanel — and its child AvatarSection — call
// useCurrentUser()/useQuery()/useMutation() directly, with no wrapper hook to
// swap out. That makes this the first component test in the repo that needs a
// real QueryClient context. useCurrentUser is still mocked below so the "me" row
// is synchronous and deterministic; the four card-preview list queries (social
// links / addresses / contacts / privacy grants) run through the REAL useQuery,
// which is why a QueryClientProvider wrapper is required at all.
// G18: `publicProfileEnabled` and `profileVisibility` deliberately DISAGREE here —
// false vs. "hub" — the row this fixture exists to make falsifiable. This is a
// stronger disagreement than a true/false-shaped mismatch would be: `hub` is a
// THIRD state a boolean cannot express at all, so any code path still deriving the
// visibility select's value from `publicProfileEnabled` cannot produce "Hub
// members" no matter how it maps true/false — it would have to render "Only me" or
// "Public". The assertion below that the select loads as "Hub members" is proof
// the panel reads `profileVisibility`, not `publicProfileEnabled`.
const ME: Me = {
  id: "user_1",
  email: "mike@example.com",
  name: "Mike Fullerton",
  avatarUrl: "",
  slug: "mike",
  publicProfileEnabled: false,
  profileVisibility: "hub",
  capabilities: [],
};

// `profileUrlFor` is a REQUIRED prop (see its doc comment on ProfilePanelProps) — no
// host is exempt from minting a URL — so the default here stands in for a host's
// injection the same way `reservedSlugs: new Set()` stands in for its own.
const PROFILE_URL_FOR = (slug: string) => `https://example.test/${slug}`;

// vi.mock factories are hoisted above ALL other top-level code, including plain
// `const` declarations — vi.hoisted() is the escape hatch for a factory-referenced
// spy that must exist before that hoisted call runs.
const { updateMe, checkSlugAvailable } = vi.hoisted(() => ({
  updateMe: vi.fn(),
  checkSlugAvailable: vi.fn(),
}));

vi.mock("../api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/auth")>();
  return {
    ...actual,
    useCurrentUser: () => ({ data: ME, isLoading: false, isError: false }),
    updateMe,
    checkSlugAvailable,
  };
});

vi.mock("../api/account", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/account")>();
  return { ...actual, listContacts: vi.fn().mockResolvedValue([]) };
});

// resolvePrivacyLevel/setPrivacyGrant/socialLinksKey/addressesKey/PRIVACY_KEY stay real
// (pure helpers / key builders — AvatarSection calls resolvePrivacyLevel and
// setPrivacyGrant directly) — only the network-calling list functions are stubbed.
vi.mock("@agentic-toolkit/data/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agentic-toolkit/data/profile")>();
  return {
    ...actual,
    listSocialLinks: vi.fn().mockResolvedValue([]),
    listAddresses: vi.fn().mockResolvedValue([]),
    getPrivacyGrants: vi.fn().mockResolvedValue([]),
  };
});

afterEach(() => {
  cleanup();
  updateMe.mockReset();
  checkSlugAvailable.mockReset();
});

function saveButton() {
  return screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
}

/** `reservedSlugs` is a REQUIRED prop (a host without a protected namespace does not
 *  exist), so the helper defaults it to the empty set — the explicit "generic validation
 *  only" answer — and each test overrides it when the reserved list is the subject. */
async function renderPanel(props: Partial<ProfilePanelProps> = {}) {
  const resolved: ProfilePanelProps = {
    reservedSlugs: new Set(),
    profileUrlFor: PROFILE_URL_FOR,
    ...props,
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={qc}>
      <ProfilePanel {...resolved} />
    </QueryClientProvider>,
  );
  // Let the mocked card-preview queries settle before asserting — they don't feed
  // canSave, but leaving them pending past the test boundary trips React's "not
  // wrapped in act" warning.
  await waitFor(() => {
    expect(listSocialLinks).toHaveBeenCalled();
    expect(listAddresses).toHaveBeenCalled();
    expect(listContacts).toHaveBeenCalled();
    expect(getPrivacyGrants).toHaveBeenCalled();
  });
  return result;
}

describe("ProfilePanel — Save enables on a real value diff against the loaded row, not a touched-flag", () => {
  it("is disabled at mount (loaded, unedited)", async () => {
    await renderPanel();
    expect(saveButton().disabled).toBe(true);
  });

  it("enables once the display name is actually changed", async () => {
    await renderPanel();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Mike F." },
    });
    expect(saveButton().disabled).toBe(false);
  });

  it("goes back to disabled on an edit-and-revert — typing a value then restoring the original must NOT leave Save enabled", async () => {
    // This is the coordinator's exact scenario: `Object.keys(edits).length > 0`
    // stays true forever once a field is touched, even after the draft is typed
    // back to the server value — Save must track the VALUE, not touched-ness.
    await renderPanel();
    const field = screen.getByLabelText("Display name") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "Mike F." } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(field, { target: { value: "Mike Fullerton" } });
    expect(field.value).toBe("Mike Fullerton");
    expect(saveButton().disabled).toBe(true);
  });

  it("clicking Save while enabled calls updateMe with only the changed field, trimmed", async () => {
    updateMe.mockResolvedValue(ME);
    await renderPanel();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "  Mike F.  " },
    });
    fireEvent.click(saveButton());
    await waitFor(() => {
      // react-query's mutationFn is invoked with a second (context) argument in
      // this version — assert on the first (the actual PATCH body) only.
      expect(updateMe).toHaveBeenCalled();
      // Non-null: the toHaveBeenCalled() assertion above already proves calls[0] exists.
      expect(updateMe.mock.calls[0]![0]).toEqual({ name: "Mike F." });
    });
  });
});

describe("ProfilePanel — one click, one write", () => {
  it("disables Save for the duration of the write, so a second click can't reach it", async () => {
    updateMe.mockReturnValue(new Promise(() => {})); // never settles
    await renderPanel();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Mike F." },
    });
    // Held by reference: the label flips to "Saving…", so a name query stops finding it.
    const button = saveButton();
    fireEvent.click(button);
    await waitFor(() => expect(updateMe).toHaveBeenCalledTimes(1));

    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    await act(async () => {}); // let a would-be second mutation reach the mutationFn
    expect(updateMe).toHaveBeenCalledTimes(1);
  });

  it("releases the latch when the write settles, so the NEXT edit is still saveable", async () => {
    // The mirror of the two tests above: a guard that never clears would wedge the panel
    // after its first successful save — Save would light up on the next edit and do
    // nothing. `onSettled` (not `onSuccess`) clears it, so a failed save frees it too.
    updateMe.mockResolvedValue(ME);
    await renderPanel();
    const field = screen.getByLabelText("Display name");
    fireEvent.change(field, { target: { value: "Mike F." } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(updateMe).toHaveBeenCalledTimes(1));
    await act(async () => {}); // let onSuccess/onSettled run

    fireEvent.change(field, { target: { value: "Mike G." } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(updateMe).toHaveBeenCalledTimes(2));
    expect(updateMe.mock.calls[1]![0]).toEqual({ name: "Mike G." });
  });

  it("ignores a second click that lands before the disabled state can render", async () => {
    // The button above is only dark once React has re-rendered with `isPending`. Two
    // activations inside a SINGLE commit (a fast double-click, or any future
    // Enter-submits-the-form path) run the same handler closure twice with the
    // pre-save render's values — the exact re-entrancy `useAction.run` was proven to
    // have in the dialogs. `handleSave`'s own guard is what stops the second one.
    updateMe.mockReturnValue(new Promise(() => {})); // never settles
    await renderPanel();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Mike F." },
    });
    const button = saveButton();
    await act(async () => {
      button.click();
      button.click();
    });

    expect(updateMe).toHaveBeenCalledTimes(1);
  });
});

describe("ProfilePanel — reserved-slug rejection is host-injected, not built in", () => {
  // This package is MECHANISM tier and can't import the family's reserved-word list
  // (VOCABULARY tier), so ProfilePanel takes it as a prop instead (see the prop's doc
  // comment). These two tests pin both halves of that contract against the REAL
  // rendered hint text, not the validator in isolation. The prop is required, so a host
  // cannot reach the second case by forgetting — it has to ask for it with an empty set.
  it('surfaces "That slug is reserved." instantly, with no debounce wait, when the host supplies a matching set', async () => {
    await renderPanel({ reservedSlugs: new Set(["admin"]) });
    fireEvent.change(screen.getByLabelText("Slug"), {
      target: { value: "admin" },
    });
    expect(screen.getByText("That slug is reserved.")).toBeInTheDocument();
  });

  it("does not reject a reserved-looking word when the host supplies an empty set", async () => {
    await renderPanel({ reservedSlugs: new Set() });
    fireEvent.change(screen.getByLabelText("Slug"), {
      target: { value: "admin" },
    });
    expect(screen.queryByText("That slug is reserved.")).not.toBeInTheDocument();
  });
});

describe("ProfilePanel — profile visibility select replaces the public-profile switch", () => {
  it('loads the select as "Hub members" from `profileVisibility`, which `publicProfileEnabled: false` alone could never produce (see the ME fixture comment)', async () => {
    await renderPanel();
    expect(
      screen.getByRole("button", { name: "Profile visibility" }),
    ).toHaveTextContent("Hub members");
  });

  it("renders the host-injected profileUrlFor(slug) — in both the slug hint and the visibility subtitle — never a hardcoded host", async () => {
    await renderPanel();
    expect(screen.getAllByText("https://example.test/mike")).toHaveLength(2);
    expect(
      screen.queryByText(/agenticdeveloperhub\.com/),
    ).not.toBeInTheDocument();
  });

  it('choosing "Only me" sends profileVisibility: "private" — the STORED word, not the UI literal "only-me"', async () => {
    updateMe.mockResolvedValue(ME);
    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Profile visibility" }));
    fireEvent.click(screen.getByRole("option", { name: /Only me/ }));
    fireEvent.click(saveButton());
    await waitFor(() => {
      expect(updateMe).toHaveBeenCalled();
      expect(updateMe.mock.calls[0]![0]).toEqual({
        profileVisibility: "private",
      });
    });
  });
});
