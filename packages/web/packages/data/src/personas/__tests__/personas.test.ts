// Persona rdids are DERIVED (`persona.<owner-slug>.<slug>`); the slug is the only user-editable
// segment, so `api.personas.update()` must re-mint the rdid mapping (leaf-swap +
// identifiersApi.rename) whenever the slug changes — mirroring ecosystemsApi.update(). Only the
// transport (`authedJson`, re-exported by `../personas` via `../http` from `@agentic-toolkit/auth/client`)
// and `identifiersApi` are stubbed; `isNotFound` stays the real helper (defined in `../http`), so the
// 404-recovery branch exercises the actual AuthHttpError-based predicate.
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@agentic-toolkit/auth/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/auth/client")>()),
  authedJson: vi.fn(),
}));
vi.mock("../../ecosystems/identifiers", () => ({
  identifiersApi: { rename: vi.fn() },
}));

import { authedJson, AuthHttpError } from "@agentic-toolkit/auth/client";
import { identifiersApi } from "../../ecosystems/identifiers";
import { api } from "../personas";
import type { Persona, PersonaBody } from "../personas";

const mockedJson = vi.mocked(authedJson);
const mockedRename = vi.mocked(identifiersApi.rename);

const BODY: PersonaBody = {
  slug: "bob",
  name: "Bob",
  modelPrompt: "You are Bob.",
};

function row(overrides: Partial<Persona> = {}): Persona {
  return {
    id: "persona.acme.bob",
    slug: "bob",
    name: "Bob",
    description: null,
    modelPrompt: "You are Bob.",
    voice: null,
    character: null,
    examples: null,
    avatarAttachmentId: null,
    serviceId: null,
    model: null,
    visibility: "private",
    ownedEcosystemId: null,
    userId: "u-1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as unknown as Persona & typeof overrides;
}

beforeEach(() => {
  mockedJson.mockReset();
  mockedRename.mockReset();
});

describe("personas.update", () => {
  it("no slug change: PUTs under the current id and does NOT rename", async () => {
    mockedJson.mockResolvedValueOnce(row());
    const saved = await api.personas.update("persona.acme.bob", { ...BODY, slug: "bob" });
    expect(mockedJson).toHaveBeenCalledTimes(1);
    expect(mockedJson).toHaveBeenCalledWith("/api/persona/personas/persona.acme.bob", {
      method: "PUT",
      body: JSON.stringify({ ...BODY, slug: "bob" }),
    });
    expect(mockedRename).not.toHaveBeenCalled();
    expect(saved.id).toBe("persona.acme.bob");
  });

  it("slug change: PUTs under the OLD id, then renames to the leaf-swapped rdid, then returns the re-keyed entity", async () => {
    mockedJson.mockResolvedValueOnce(row({ slug: "bobby" }));
    mockedRename.mockResolvedValueOnce(undefined);
    const saved = await api.personas.update("persona.acme.bob", { ...BODY, slug: "bobby" });

    expect(mockedJson).toHaveBeenCalledWith("/api/persona/personas/persona.acme.bob", {
      method: "PUT",
      body: JSON.stringify({ ...BODY, slug: "bobby" }),
    });
    // Renamed AFTER the PUT succeeds, to the leaf-swapped rdid (scope preserved, leaf swapped).
    expect(mockedRename).toHaveBeenCalledWith("persona.acme.bob", "persona.acme.bobby");
    // The rename call happens after the PUT resolves — assert call order via mock invocation order.
    const putOrder = mockedJson.mock.invocationCallOrder[0]!;
    const renameOrder = mockedRename.mock.invocationCallOrder[0]!;
    expect(putOrder).toBeLessThan(renameOrder);
    expect(saved.id).toBe("persona.acme.bobby");
  });

  it("404 on the PUT under the old id recovers by re-PUTting under the new id when it already resolves there", async () => {
    // First call: PUT under the old id -> 404 (rename already applied server-side, response lost).
    mockedJson.mockRejectedValueOnce(new AuthHttpError(404, "Not Found"));
    // Second call: the disambiguating GET under the new id -> resolves (persona exists there).
    mockedJson.mockResolvedValueOnce(row({ slug: "bobby" }));
    // Third call: the recovery PUT under the new id -> succeeds.
    mockedJson.mockResolvedValueOnce(row({ slug: "bobby" }));

    const saved = await api.personas.update("persona.acme.bob", { ...BODY, slug: "bobby" });

    expect(mockedJson).toHaveBeenNthCalledWith(1, "/api/persona/personas/persona.acme.bob", {
      method: "PUT",
      body: JSON.stringify({ ...BODY, slug: "bobby" }),
    });
    expect(mockedJson).toHaveBeenNthCalledWith(2, "/api/persona/personas/persona.acme.bobby");
    expect(mockedJson).toHaveBeenNthCalledWith(3, "/api/persona/personas/persona.acme.bobby", {
      method: "PUT",
      body: JSON.stringify({ ...BODY, slug: "bobby" }),
    });
    // The recovery path never calls rename — the rename already happened server-side.
    expect(mockedRename).not.toHaveBeenCalled();
    expect(saved.id).toBe("persona.acme.bobby");
  });

  it("404 on the PUT under the old id rethrows when the new id does NOT resolve (genuinely deleted)", async () => {
    mockedJson.mockRejectedValueOnce(new AuthHttpError(404, "Not Found"));
    mockedJson.mockRejectedValueOnce(new AuthHttpError(404, "Not Found"));
    await expect(
      api.personas.update("persona.acme.bob", { ...BODY, slug: "bobby" }),
    ).rejects.toThrow();
    expect(mockedRename).not.toHaveBeenCalled();
  });
});
