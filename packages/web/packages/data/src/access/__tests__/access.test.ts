import { describe, expect, it, vi, beforeEach } from "vitest";
import { accessApi } from "../access";

// `accessApi.listFeatures` is otherwise NEVER exercised: every consumer test mocks
// `@agentic-toolkit/data/access` wholesale (see TeamPermissionsPane.test.tsx), so neither the
// request it builds nor its response unwrap has ever run for real. That matters more than usual
// here — TeamPermissionsPane treats ANY thrown error as "this backend predates the endpoint" and
// silently degrades to the two-area fallback, so a wrong URL or a wrong response key would not
// surface as a crash or a wrong answer; it would just look exactly like an old backend.

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ features: [] }),
    text: async () => '{"features":[]}',
  });
  vi.stubGlobal("fetch", fetchMock);
});

const urlOf = () => String(fetchMock.mock.calls[0]![0]);

/** Re-point the shared `fetch` stub at one specific JSON body. */
const respondWith = (body: unknown) =>
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

describe("accessApi.listFeatures", () => {
  it("GETs the workspace-scoped features route", async () => {
    await accessApi.listFeatures("acme");
    expect(urlOf()).toContain("/api/access/features");
    expect(urlOf()).toContain("workspace=acme");
  });

  it("encodes a workspace slug that needs escaping", async () => {
    await accessApi.listFeatures("a b/c");
    expect(urlOf()).toContain(`workspace=${encodeURIComponent("a b/c")}`);
  });

  it("unwraps the { features } envelope to the bare array", async () => {
    respondWith({ features: [{ key: "projects", label: "Projects" }] });
    await expect(accessApi.listFeatures("acme")).resolves.toEqual([
      { key: "projects", label: "Projects" },
    ]);
  });

  it("preserves registration order across multiple rows", async () => {
    const rows = [
      { key: "projects", label: "Projects" },
      { key: "personas", label: "Personas" },
      { key: "audiences", label: "Audiences" },
    ];
    respondWith({ features: rows });
    await expect(accessApi.listFeatures("acme")).resolves.toEqual(rows);
  });

  it("resolves an EMPTY list to an empty array (a valid, if unreadable, shape)", async () => {
    respondWith({ features: [] });
    await expect(accessApi.listFeatures("acme")).resolves.toEqual([]);
  });

  // The shape guard: every element must be an object with a string `key` and a string `label`
  // (the exact fields AccessFeatureRow declares in wire.ts). These are the two malformed-but-
  // plausible shapes review found reaching the caller as usable values via the old bare cast —
  // a crash (`.map` on a string) and a silently-broken editor (`feature: undefined` rows) — so
  // each of these MUST reject, not resolve, for the caller's existing catch/fallback to apply.
  it("rejects when `features` is a string, not an array", async () => {
    respondWith({ features: "abc" });
    await expect(accessApi.listFeatures("acme")).rejects.toThrow();
  });

  it("rejects when `features` is an array of bare strings (no `label`)", async () => {
    respondWith({ features: ["projects", "personas"] });
    await expect(accessApi.listFeatures("acme")).rejects.toThrow();
  });

  it("rejects when `features` is an object rather than an array", async () => {
    respondWith({ features: { projects: "Projects" } });
    await expect(accessApi.listFeatures("acme")).rejects.toThrow();
  });

  it("rejects when the `features` key is absent entirely", async () => {
    respondWith({});
    await expect(accessApi.listFeatures("acme")).rejects.toThrow();
  });

  it("rejects when a row is missing `label`", async () => {
    respondWith({ features: [{ key: "projects" }] });
    await expect(accessApi.listFeatures("acme")).rejects.toThrow();
  });

  it("rejects when a row's `key` is the wrong type", async () => {
    respondWith({ features: [{ key: 1, label: "Projects" }] });
    await expect(accessApi.listFeatures("acme")).rejects.toThrow();
  });
});
