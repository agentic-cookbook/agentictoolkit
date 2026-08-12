import { describe, expect, it, vi, beforeEach } from "vitest";

const authedJson = vi.fn();
vi.mock("@agentic-toolkit/auth/client", () => ({
  authedJson: (...args: unknown[]) => authedJson(...args),
  authedRequest: vi.fn(),
}));

import { listContacts } from "./account";

beforeEach(() => authedJson.mockReset());

describe("account api", () => {
  it("reads contacts from the same relative path hub used", async () => {
    authedJson.mockResolvedValue({ items: [] });
    await listContacts();
    expect(authedJson).toHaveBeenCalledWith("/api/account/contacts");
  });
});
