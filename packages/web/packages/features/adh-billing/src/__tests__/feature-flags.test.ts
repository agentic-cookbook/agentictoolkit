import { beforeEach, describe, expect, it, vi } from "vitest";

const authedJson = vi.fn();
const authedRequest = vi.fn();
vi.mock("@agentic-toolkit/auth/client", () => ({
  authedJson: (...a: unknown[]) => authedJson(...a),
  authedRequest: (...a: unknown[]) => authedRequest(...a),
}));

import { setEcosystemFlag } from "../api/feature-flags";

beforeEach(() => {
  authedJson.mockReset();
  authedRequest.mockReset();
});

describe("setEcosystemFlag", () => {
  it("PUTs when the flag row already exists, and does not POST", async () => {
    authedJson.mockResolvedValueOnce({});
    await setEcosystemFlag("eco_1", "billing", true);
    expect(authedJson).toHaveBeenCalledTimes(1);
    expect(authedJson.mock.calls[0][0]).toBe("/api/ecosystem/feature-flags/eco_1/billing");
    expect(authedJson.mock.calls[0][1]).toMatchObject({ method: "PUT" });
  });

  // The ordinary state of a fresh ecosystem is NO row at all — which is exactly the state the
  // operator is trying to leave, so a 404 here must create rather than fail.
  it("falls back to POST on the PUT's 404, carrying the key in the body", async () => {
    authedJson
      .mockRejectedValueOnce(Object.assign(new Error("not found"), { status: 404 }))
      .mockResolvedValueOnce({});
    await setEcosystemFlag("eco_1", "billing", true, "Sell offers through Stripe.");
    expect(authedJson).toHaveBeenCalledTimes(2);
    expect(authedJson.mock.calls[1][0]).toBe("/api/ecosystem/feature-flags/eco_1");
    expect(authedJson.mock.calls[1][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(authedJson.mock.calls[1][1].body)).toEqual({
      key: "billing",
      enabled: true,
      description: "Sell offers through Stripe.",
    });
  });

  it("rethrows any status other than 404 rather than creating a second row", async () => {
    authedJson.mockRejectedValueOnce(Object.assign(new Error("nope"), { status: 403 }));
    await expect(setEcosystemFlag("eco_1", "billing", true)).rejects.toThrow("nope");
    expect(authedJson).toHaveBeenCalledTimes(1);
  });
});
