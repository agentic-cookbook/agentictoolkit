// Pins the ?workspace= URL/method/body contract for the owner-scoped profile routes,
// with the transport (../../http) mocked — mirrors ecosystems.test.ts.
//
// It came across from the hub with the client it covers: `?workspace=` is the whole reason the
// profile API is shared at all (a profile belongs to a PRINCIPAL, so the organizations site's
// Settings rail reads the same rows), and a contract test left behind in one host would have
// stopped seeing the code it names the moment the implementation moved.
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../http")>()),
  authedJson: vi.fn(),
  authedRequest: vi.fn(),
}));

import {
  listSocialLinks, createSocialLink, updateSocialLink, deleteSocialLink,
  listAddresses,
} from "../profile";
import { authedJson, authedRequest } from "../../http";

const mockedJson = vi.mocked(authedJson);
const mockedRequest = vi.mocked(authedRequest);

beforeEach(() => {
  mockedJson.mockReset();
  mockedRequest.mockReset();
  mockedJson.mockResolvedValue([] as never);
  mockedRequest.mockResolvedValue(undefined as never);
});

describe("profile api ?workspace= threading", () => {
  it("lists personal social links with no query when no workspace", async () => {
    await listSocialLinks();
    expect(mockedJson).toHaveBeenCalledWith("/api/content/social-links");
  });

  it("lists org social links with ?workspace= when a slug is given", async () => {
    await listSocialLinks({ workspace: "acme" });
    expect(mockedJson).toHaveBeenCalledWith("/api/content/social-links?workspace=acme");
  });

  it("encodes the workspace slug", async () => {
    await listAddresses({ workspace: "a/b" });
    expect(mockedJson).toHaveBeenCalledWith("/api/content/addresses?workspace=a%2Fb");
  });

  it("posts a create with the workspace query", async () => {
    mockedJson.mockResolvedValueOnce({} as never);
    await createSocialLink({ platform: "github", url: "https://x", handle: "" }, { workspace: "acme" });
    expect(mockedJson).toHaveBeenCalledWith("/api/content/social-links?workspace=acme", {
      method: "POST",
      body: JSON.stringify({ platform: "github", url: "https://x", handle: "" }),
    });
  });

  it("puts an update with id + workspace query", async () => {
    mockedJson.mockResolvedValueOnce({} as never);
    await updateSocialLink("id1", { platform: "github", url: "https://x", handle: "" }, { workspace: "acme" });
    expect(mockedJson).toHaveBeenCalledWith("/api/content/social-links/id1?workspace=acme", {
      method: "PUT",
      body: JSON.stringify({ platform: "github", url: "https://x", handle: "" }),
    });
  });

  it("deletes with id + workspace query via authedRequest", async () => {
    await deleteSocialLink("id1", { workspace: "acme" });
    expect(mockedRequest).toHaveBeenCalledWith("/api/content/social-links/id1?workspace=acme", {
      method: "DELETE",
    });
  });
});
