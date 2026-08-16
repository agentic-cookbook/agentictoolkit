// Every test in packages/data/src lives under a `__tests__/` sibling — no exceptions.
import { describe, expect, it } from "vitest";
import { PERSONA_FIELDS, personaBlank, personaToBody } from "../fields";
import type { CannedChatConfig } from "../personas";
import { CHAT_STATUS_DEFAULT } from "../chat-status";

describe("persona field descriptors", () => {
  it("produces the same blank draft the editor used to hardcode", () => {
    expect(personaBlank()).toEqual({
      id: "__draft__", slug: "", name: "", description: null, modelPrompt: "",
      voice: null, character: null, examples: null, avatarAttachmentId: null,
      serviceId: null, serviceName: null, model: null, visibility: "private",
      cannedChat: null,
      // NOT null: decision 1 — a new persona is created with the basics already in it,
      // and `blank` being the prepopulated set is what implements that with no
      // create-time special case anywhere.
      chatStatus: CHAT_STATUS_DEFAULT,
    });
  });

  it("gives each new draft its own chat status rows", () => {
    const a = personaBlank();
    const b = personaBlank();
    expect(a.chatStatus).not.toBe(b.chatStatus);
    expect(a.chatStatus!.words).not.toBe(b.chatStatus!.words);
  });

  it("passes chatStatus through structurally", () => {
    const cfg = {
      words: [{ tags: ["think"], present: "fleeping", past: "fleeped" }],
      icons: [{ tags: [], frames: ["o", "O"] }],
      tint: { color: "#a78bfa", applies: "both" as const },
    };
    expect(personaToBody({ ...personaBlank(), chatStatus: cfg }).chatStatus).toEqual(cfg);
  });

  it("trims and drops blank optional strings, as toBody always did", () => {
    const body = personaToBody({ ...personaBlank(), slug: "  s  ", name: " n ", voice: "   ", character: "c" });
    expect(body.slug).toBe("s");
    expect(body.name).toBe("n");
    expect(body.voice).toBeUndefined();
    expect(body.character).toBe("c");
  });

  it("omits display-only joins from the wire body", () => {
    const body = personaToBody({ ...personaBlank(), serviceName: "Groq" });
    expect(body).not.toHaveProperty("serviceName");
    expect(body).not.toHaveProperty("id");
  });

  it("passes cannedChat through structurally", () => {
    // A REAL config — `pacing` is non-nullable in CannedChatConfig, so a `pacing: null`
    // literal would only compile behind an `as never` cast and would assert on a value the
    // runtime never produces.
    const cfg: CannedChatConfig = {
      enabled: true,
      pacing: { thinkMinMs: 400, thinkJitterMs: 200, tokenMinMs: 12, tokenJitterMs: 8, reveal: "word" },
      script: { intro: ["a"], seeded: [], fallbacks: [], onExhausted: "reshuffle" },
    };
    expect(personaToBody({ ...personaBlank(), cannedChat: cfg }).cannedChat).toEqual(cfg);
  });

  it("passes raw fields through untouched, nulls included", () => {
    // `raw` fields never trim/drop — a typo'd "omit" would silently vanish from the body,
    // and `toBeNull()` alone wouldn't catch it (undefined isn't null but isn't caught either
    // way); assert key presence explicitly via toHaveProperty.
    const draft = {
      ...personaBlank(),
      modelPrompt: "  leading and trailing  ", // raw: NOT trimmed, unlike slug/name
      avatarAttachmentId: null,
      serviceId: "svc_1",
      model: null,
      visibility: "unlisted" as const,
    };
    const body = personaToBody(draft);
    expect(body.modelPrompt).toBe("  leading and trailing  ");
    expect(body).toHaveProperty("avatarAttachmentId", null);
    expect(body.serviceId).toBe("svc_1");
    expect(body).toHaveProperty("model", null);
    expect(body.visibility).toBe("unlisted");
  });

  it("describes every field exactly once", () => {
    const keys = PERSONA_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
