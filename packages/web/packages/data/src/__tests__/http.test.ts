// Runtime unit tests for http.ts's status predicates. The predicates duck-type on
// a numeric `.status` rather than `instanceof` one AuthHttpError class, so a host
// that layers its OWN auth client atop this package (a SECOND, distinct
// AuthHttpError class) still gets correct results. `HostAuthHttpError` models that
// second class — an `instanceof` check on this package's class would return false
// for it, which is exactly what these tests pin.
import { describe, expect, it } from "vitest";
import { AuthHttpError as ToolkitAuthHttpError } from "@agentic-toolkit/auth/client";
import { isNotFound, isConflict, isForbidden, isServiceUnavailable } from "../http";

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
