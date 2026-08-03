// Persona rdids are DERIVED (`persona.<owner-slug>.<slug>`) from the stored slug, and the update
// body always carries `slug` — so the PUT IS the rename: the server moves the address columns and
// cascades the new address onto the handle. `api.personas.update()` is therefore ONE call, and the
// id it returns is the server's derived answer, never a client-side leaf swap. Only the transport
// (`authedJson`, re-exported by `../personas` via `../http` from `@agentic-toolkit/auth/client`) is
// stubbed.
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@agentic-toolkit/auth/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/auth/client")>()),
  authedJson: vi.fn(),
}));

import { authedJson, AuthHttpError } from "@agentic-toolkit/auth/client";
import { api } from "../personas";
import type { Persona, PersonaBody } from "../personas";

const mockedJson = vi.mocked(authedJson);

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
    ...overrides,
  } as unknown as Persona;
}

beforeEach(() => {
  mockedJson.mockReset();
});

describe("personas.update", () => {
  it("no slug change: ONE PUT under the current id", async () => {
    mockedJson.mockResolvedValueOnce(row());
    const saved = await api.personas.update("persona.acme.bob", { ...BODY, slug: "bob" });
    expect(mockedJson).toHaveBeenCalledTimes(1);
    expect(mockedJson).toHaveBeenCalledWith("/api/persona/personas/persona.acme.bob", {
      method: "PUT",
      body: JSON.stringify({ ...BODY, slug: "bob" }),
    });
    expect(saved.id).toBe("persona.acme.bob");
  });

  // The defect this replaced: the PUT already cascaded the handle onto the new address, and the
  // follow-up identifiers PATCH then tried to rename a superseded alias onto an rdid the row
  // itself now holds — a taken target (23505 -> 409), reporting a successful rename as a failure.
  it("slug change: STILL one PUT — the slug in the body IS the rename", async () => {
    mockedJson.mockResolvedValueOnce(row({ id: "persona.acme.bobby", slug: "bobby" }));
    const saved = await api.personas.update("persona.acme.bob", { ...BODY, slug: "bobby" });

    expect(mockedJson).toHaveBeenCalledTimes(1);
    expect(mockedJson).toHaveBeenCalledWith("/api/persona/personas/persona.acme.bob", {
      method: "PUT",
      body: JSON.stringify({ ...BODY, slug: "bobby" }),
    });
  });

  it("returns the address the SERVER derived, not a client-side leaf swap", async () => {
    // The server's cascade is the authority: a handle it declined to move (a legacy
    // reverse-domain mapping) comes back unchanged, and callers must see that, not a guess.
    mockedJson.mockResolvedValueOnce(row({ id: "com.acme.bob", slug: "bobby" }));
    const saved = await api.personas.update("persona.acme.bob", { ...BODY, slug: "bobby" });
    expect(saved.id).toBe("com.acme.bob");
  });

  it("propagates a failed PUT — one call has no half-landed state to recover", async () => {
    mockedJson.mockRejectedValueOnce(new AuthHttpError(404, "Not Found"));
    await expect(
      api.personas.update("persona.acme.bob", { ...BODY, slug: "bobby" }),
    ).rejects.toThrow();
    expect(mockedJson).toHaveBeenCalledTimes(1);
  });
});
