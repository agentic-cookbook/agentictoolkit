import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The auth-aware fetchers are the seam every data module goes through, so mock those rather
// than global fetch — that is what the module actually depends on.
const authedJson = vi.fn();
const authedRequest = vi.fn();
vi.mock("../http", () => ({ authedJson, authedRequest }));

const { workspacePrefsApi, readCachedWorkspace, writeCachedWorkspace } = await import(
  "../workspace-prefs"
);

beforeEach(() => {
  localStorage.clear();
  authedJson.mockReset();
  authedRequest.mockReset();
  authedRequest.mockResolvedValue(new Response(null, { status: 200 }));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("workspacePrefsApi", () => {
  it("get() unwraps the { prefs } envelope", async () => {
    authedJson.mockResolvedValue({ prefs: { slug: "acme" } });
    await expect(workspacePrefsApi.get()).resolves.toEqual({ slug: "acme" });
    expect(authedJson).toHaveBeenCalledWith("/api/me/workspace-prefs");
  });

  it("get() returns {} for a user who has never chosen (never a 404 to handle)", async () => {
    authedJson.mockResolvedValue({ prefs: {} });
    await expect(workspacePrefsApi.get()).resolves.toEqual({});
  });

  it("put() PUTs the whole shape as JSON", async () => {
    await workspacePrefsApi.put({ slug: "globex" });
    expect(authedRequest).toHaveBeenCalledWith("/api/me/workspace-prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "globex" }),
    });
  });
});

describe("the localStorage mirror", () => {
  it("round-trips the slug", () => {
    expect(readCachedWorkspace()).toBeNull();
    writeCachedWorkspace("acme");
    expect(readCachedWorkspace()).toBe("acme");
  });

  it("survives a storage failure rather than throwing (private mode / quota)", () => {
    // The workspace-root vitest.setup.ts replaces window.localStorage with a plain-object
    // in-memory shim (Node 24's experimental built-in localStorage otherwise leaves jsdom's
    // version with missing methods), so its getItem/setItem are the shim's OWN properties,
    // never inherited from Storage.prototype. Spying on Storage.prototype has no effect on
    // this object — the throw has to be injected on the shim instance itself.
    const boom = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readCachedWorkspace()).toBeNull();
    boom.mockRestore();

    const boom2 = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeCachedWorkspace("acme")).not.toThrow();
    boom2.mockRestore();
  });
});
