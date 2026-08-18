// Runtime unit tests for http.ts's status predicates. The predicates duck-type on
// a numeric `.status` rather than `instanceof` one AuthHttpError class, so a host
// that layers its OWN auth client atop this package (a SECOND, distinct
// AuthHttpError class) still gets correct results. `HostAuthHttpError` models that
// second class — an `instanceof` check on this package's class would return false
// for it, which is exactly what these tests pin.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthHttpError as ToolkitAuthHttpError } from "@agentic-toolkit/auth/client";
import { reportUnexpectedAuthError, setAuthErrorReporter } from "@agentic-toolkit/auth";
import { clientRefusal, isNotFound, isConflict, isForbidden, isServiceUnavailable } from "../http";

// A distinct constructor standing in for a host's own AuthHttpError (e.g.
// atop this one): same numeric `.status`, different class identity.
class HostAuthHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HostAuthHttpError";
  }
}

const predicates = [
  { name: "isNotFound", fn: isNotFound, status: 404 },
  { name: "isConflict", fn: isConflict, status: 409 },
  { name: "isForbidden", fn: isForbidden, status: 403 },
  { name: "isServiceUnavailable", fn: isServiceUnavailable, status: 503 },
] as const;

describe.each(predicates)("$name", ({ fn, status }) => {
  it(`recognizes this package's AuthHttpError(${status})`, () => {
    expect(fn(new ToolkitAuthHttpError(status, "boom"))).toBe(true);
  });

  it(`recognizes a host's foreign AuthHttpError(${status})`, () => {
    expect(fn(new HostAuthHttpError(status, "boom"))).toBe(true);
  });

  it("rejects a non-matching status from either class", () => {
    // 418 matches none of the predicates' statuses.
    expect(fn(new ToolkitAuthHttpError(418, "teapot"))).toBe(false);
    expect(fn(new HostAuthHttpError(418, "teapot"))).toBe(false);
  });

  it("rejects a plain Error and non-Error values", () => {
    expect(fn(new Error("boom"))).toBe(false);
    // A bare object with the right status is NOT an Error — predicates stay
    // anchored on thrown Error instances, not arbitrary shapes.
    expect(fn({ status })).toBe(false);
    expect(fn(undefined)).toBe(false);
    expect(fn(status)).toBe(false);
  });
});

// `clientRefusal` exists for ONE consequence, so it is tested against that consequence and
// not against its own `status` field: the resource dialogs hand every error they catch to
// `reportUnexpectedAuthError`, whose gate drops 4xx and REPORTS everything else. A refusal
// the client itself decided — "pick a game first", "that isn't valid JSON" — is an operator
// event, and reporting it files a mis-click as a production outage.
describe("clientRefusal", () => {
  const reported = vi.fn();

  beforeEach(() => {
    reported.mockReset();
    setAuthErrorReporter(reported);
    // The reporter throttles one report per (message + context) per minute, so every case
    // here uses its own message and no case is silenced by its predecessor.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    setAuthErrorReporter(null);
    vi.restoreAllMocks();
  });

  it("is NOT reported as an outage", () => {
    reportUnexpectedAuthError(clientRefusal("pick a game first"));
    expect(reported).not.toHaveBeenCalled();
  });

  it("is what a bare Error is not — the bare one IS reported", () => {
    reportUnexpectedAuthError(new Error("pick a game first, bare"));
    expect(reported).toHaveBeenCalledTimes(1);
  });

  it("carries the message the operator reads", () => {
    expect(clientRefusal("pick a game first").message).toBe("pick a game first");
  });

  it("takes another 4xx when one fits better, and is still dropped", () => {
    const err = clientRefusal("that name is taken locally", 409);
    expect(err.status).toBe(409);
    expect(isConflict(err)).toBe(true);
    reportUnexpectedAuthError(err);
    expect(reported).not.toHaveBeenCalled();
  });

  it("is an Error, so the shared status predicates recognize it", () => {
    expect(clientRefusal("nope")).toBeInstanceOf(Error);
    expect(isNotFound(clientRefusal("nope", 404))).toBe(true);
  });
});
