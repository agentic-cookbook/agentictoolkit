// The demo-chat authoring loop: play one turn of an UNSAVED ink script.
//
// Route: POST /api/persona/demo-preview (backend routes/personaDemoPreview.ts). It takes the
// draft source the editor is holding — never a persona id — so a persona being written for the
// first time can be tried before it has ever been saved.
//
// Deliberately server-side. Replay, keyword matching, the decaying gambit and the escalation
// cascade are one implementation, in the backend; a browser copy would be a second engine that
// agrees with the first only until someone edits one of them. And escalation cannot be shown
// client-side at all: an off-script message with a real model behind the persona is a turn the
// demo DOES NOT answer, and only the server knows whether that model exists.
//
// The same call is the editor's lint. Omit `message` with no `history` and the story plays its
// opening — replay matches against PRIOR turns, so the opening never consults a message — which
// gives the author their compile diagnostics plus what a visitor meets first, without a second
// endpoint compiling through a second code path.
import { authedJson } from "../http";

/** One choice the story would accept next. */
export interface DemoPreviewChoice {
  /** The choice's text, as written between the brackets (minus its tags). */
  text: string;
  /**
   * The words this choice ACTUALLY answers to — what the server's matcher resolved, not the
   * `# match:` tag as typed. That difference is the point: a tag written outside the choice's
   * square brackets attaches to something else and silently leaves the choice matching its own
   * wording, and this list is where the author sees it happen. See `tagPlacementHint`.
   */
  keywords: string[];
  /** Whether the author tagged this choice `# off_script`. */
  offScript: boolean;
}

export interface DemoPreviewDiagnostic {
  severity: "error" | "warning" | "info";
  /** 1-based source line, or null when the compiler's message carried none. */
  line: number | null;
  message: string;
}

export interface DemoPreviewTurn {
  /** Null ⇒ the turn ESCALATES: the real model answers and the demo says nothing. */
  text: string | null;
  /** False ⇒ the message matched no standing choice. */
  onScript: boolean;
  /** The reply is the persona's sign-in line rather than anything in the script. */
  signInLine: boolean;
  /** The story ran past the engine's wall-clock budget — it does not terminate. */
  budgetExhausted: boolean;
  /** What the story would accept next. Empty at an ending, and empty when nothing ran. */
  choices: DemoPreviewChoice[];
  /** The compile's errors, warnings and author TODOs. Empty ⇒ the script compiles. */
  diagnostics: DemoPreviewDiagnostic[];
  /** The one sentence about where `# match:` and `# off_script` go. Owned by the server. */
  tagPlacementHint: string;
}

export interface DemoPreviewBody {
  /** The draft ink source, exactly as it sits in the editor. */
  source: string;
  /** What the persona says to an anonymous visitor it cannot answer. Blank ⇒ the platform default. */
  signInLine?: string;
  /** The visitor's message. Omit with no `history` to lint and see the opening. */
  message?: string;
  /** The transcript BEFORE this message. The story is replayed over it. */
  history?: { role: "user" | "assistant"; content: string }[];
  /**
   * Preview the SIGNED-IN visitor's demo, where an off-script message falls through to the real
   * model (`text: null`). Default previews the anonymous one, which is what most visitors meet.
   */
  canEscalate?: boolean;
}

export const demoPreviewApi = {
  play: (body: DemoPreviewBody) =>
    authedJson<DemoPreviewTurn>("/api/persona/demo-preview", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
