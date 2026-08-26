// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import type { IntegrationInput } from "./IntegrationDetail";
import { saveDraft, loadDraft, clearDraft, listDrafts } from "./integration-draft-store";

// A local blank-draft builder (rather than importing `intBlank` from IntegrationDetail.tsx,
// which drags in the full component tree + @agenticdevelopertoolkit/ui deps) — this store's tests
// only need the plain data shape.
function blankDraft(providerId: string): IntegrationInput {
  return {
    providerId,
    name: "",
    clientId: "",
    clientSecret: "",
    scopes: "",
    authUrl: "",
    tokenUrl: "",
    userinfoUrl: "",
    validateUrl: "",
    credentialStyle: "",
    endpoints: {},
    fields: {},
    enabled: true,
  };
}

describe("integration-draft-store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the non-secret fields through save + load", () => {
    const draft: IntegrationInput = {
      ...blankDraft("sendgrid"),
      name: "My SendGrid",
      clientId: "client-123",
      scopes: "read write",
      authUrl: "https://example.com/authorize",
    };
    saveDraft("eco-1", "sendgrid", draft, []);
    const loaded = loadDraft("eco-1", "sendgrid");
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe("My SendGrid");
    expect(loaded?.clientId).toBe("client-123");
    expect(loaded?.scopes).toBe("read write");
    expect(loaded?.authUrl).toBe("https://example.com/authorize");
    expect(loaded?.providerId).toBe("sendgrid");
  });

  it("never persists clientSecret or secret fields[*] values", () => {
    const draft: IntegrationInput = {
      ...blankDraft("postmark"),
      clientSecret: "super-secret-value",
      fields: { apiKey: "sk-live-abc123", region: "us-east" },
    };
    saveDraft("eco-1", "postmark", draft, ["apiKey"]);

    // Assert the raw persisted JSON itself contains no trace of the secret values.
    const raw = window.localStorage.getItem("adh.int-draft.eco-1.postmark");
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("super-secret-value");
    expect(raw).not.toContain("sk-live-abc123");
    const parsed = JSON.parse(raw as string);
    expect(parsed.draft.clientSecret).toBe("");
    expect(parsed.draft.fields.apiKey).toBe("");
    // Non-secret field keys are preserved.
    expect(parsed.draft.fields.region).toBe("us-east");

    const loaded = loadDraft("eco-1", "postmark");
    expect(loaded?.clientSecret).toBe("");
    expect(loaded?.fields.apiKey).toBe("");
    expect(loaded?.fields.region).toBe("us-east");
  });

  it("listDrafts returns only the providers saved under that ecosystem", () => {
    saveDraft("eco-1", "sendgrid", blankDraft("sendgrid"), []);
    saveDraft("eco-1", "postmark", blankDraft("postmark"), []);
    saveDraft("eco-2", "twilio", blankDraft("twilio"), []);

    const eco1 = listDrafts("eco-1").map((d) => d.providerId).sort();
    expect(eco1).toEqual(["postmark", "sendgrid"]);

    const eco2 = listDrafts("eco-2").map((d) => d.providerId);
    expect(eco2).toEqual(["twilio"]);
  });

  it("clearDraft removes the saved draft", () => {
    saveDraft("eco-1", "sendgrid", blankDraft("sendgrid"), []);
    expect(loadDraft("eco-1", "sendgrid")).not.toBeNull();
    clearDraft("eco-1", "sendgrid");
    expect(loadDraft("eco-1", "sendgrid")).toBeNull();
  });

  it("returns null (not throw) on malformed JSON in storage", () => {
    window.localStorage.setItem("adh.int-draft.eco-1.broken", "{not valid json");
    expect(() => loadDraft("eco-1", "broken")).not.toThrow();
    expect(loadDraft("eco-1", "broken")).toBeNull();
  });
});
