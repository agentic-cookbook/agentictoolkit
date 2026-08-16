import { describe, expect, it, vi, beforeEach } from "vitest";
import { demoPreviewApi } from "../demo-preview";

// This client has one job and one trap. The job: post the DRAFT source, so a persona can be
// tried before it has ever been saved. The trap: the same endpoint is also the editor's lint,
// and the lint arm is "no message" — an empty string is a different request (a visitor who
// said nothing), so the omission has to survive JSON.stringify rather than be filled in.

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      text: "Hi.",
      onScript: true,
      signInLine: false,
      budgetExhausted: false,
      choices: [],
      diagnostics: [],
      tagPlacementHint: "",
    }),
    text: async () => "{}",
  });
  vi.stubGlobal("fetch", fetchMock);
});

const urlOf = () => String(fetchMock.mock.calls[0]![0]);
const initOf = () => fetchMock.mock.calls[0]![1] ?? {};
const bodyOf = () => JSON.parse(String(initOf().body));

describe("demoPreviewApi", () => {
  it("posts the draft source to the persona-prefixed route", async () => {
    await demoPreviewApi.play({ source: "Hi.\n-> DONE\n" });
    expect(urlOf()).toBe("/api/persona/demo-preview");
    expect(initOf().method).toBe("POST");
    expect(bodyOf().source).toBe("Hi.\n-> DONE\n");
  });

  it("omits the message entirely for the lint — not an empty one", async () => {
    // `{ message: "" }` is a visitor who sent a blank message; the lint is a call with NO
    // message, which the backend reads as "compile this and play the opening". The distinction
    // is invisible in the UI and total on the wire, so it is asserted here.
    await demoPreviewApi.play({ source: "Hi." });
    expect(bodyOf()).not.toHaveProperty("message");
    expect(bodyOf()).not.toHaveProperty("history");
  });

  it("carries the transcript, the sign-in line and the caller kind when playing a turn", async () => {
    await demoPreviewApi.play({
      source: "Hi.",
      signInLine: "Sign in and I can actually answer that.",
      message: "yes please",
      history: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "Hi." },
      ],
      canEscalate: true,
    });
    const body = bodyOf();
    expect(body.message).toBe("yes please");
    // History is what came BEFORE this message — the engine replays the story over it, so a
    // message duplicated into both would advance the story twice for one turn.
    expect(body.history).toHaveLength(2);
    expect(body.history[1]).toEqual({ role: "assistant", content: "Hi." });
    expect(body.signInLine).toBe("Sign in and I can actually answer that.");
    expect(body.canEscalate).toBe(true);
  });

  it("returns the turn the server reported, escalation included", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: null,
        onScript: false,
        signInLine: false,
        budgetExhausted: false,
        choices: [{ text: "Yes", keywords: ["yes", "sure"], offScript: false }],
        diagnostics: [{ severity: "warning", line: 3, message: "unused knot" }],
        tagPlacementHint: "Put # match: inside the brackets.",
      }),
      text: async () => "{}",
    });
    const turn = await demoPreviewApi.play({ source: "Hi.", message: "a cat", canEscalate: true });
    // Null text is not "nothing came back" — it is the demo declining the turn to the real model.
    expect(turn.text).toBeNull();
    expect(turn.choices[0]!.keywords).toEqual(["yes", "sure"]);
    expect(turn.diagnostics[0]!.line).toBe(3);
  });
});
