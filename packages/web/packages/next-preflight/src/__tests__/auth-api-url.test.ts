import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { assertAuthApiUrl } from "../auth-api-url.js";

const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

beforeEach(() => {
  delete process.env.VERCEL_ENV;
});
afterEach(() => {
  if (ORIGINAL_VERCEL_ENV === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
  }
});

describe("assertAuthApiUrl", () => {
  it("returns whatever it was given, including undefined, when VERCEL_ENV is unset", () => {
    expect(() => assertAuthApiUrl(undefined, "hub")).not.toThrow();
    expect(assertAuthApiUrl(undefined, "hub")).toBeUndefined();
    expect(assertAuthApiUrl("https://auth.example.com", "hub")).toBe("https://auth.example.com");
    expect(assertAuthApiUrl("", "hub")).toBe("");
  });

  it.each([
    ["undefined", undefined],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("throws naming NEXT_PUBLIC_AUTH_API_URL when VERCEL_ENV is set and the url is %s", (_label, url) => {
    process.env.VERCEL_ENV = "preview";
    expect(() => assertAuthApiUrl(url, "hub")).toThrowError(/NEXT_PUBLIC_AUTH_API_URL is not set/);
  });

  it("returns the url when VERCEL_ENV is set and a real url is given", () => {
    process.env.VERCEL_ENV = "production";
    expect(assertAuthApiUrl("https://auth.example.com", "hub")).toBe("https://auth.example.com");
  });
});
