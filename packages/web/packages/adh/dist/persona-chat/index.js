// src/persona-chat/index.ts
var CONVERSATIONS = "/api/chat/conversations";
function parseData(data) {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
function toStreamEvent(event, data) {
  switch (event) {
    case "token":
      return { type: "token", text: parseData(data)?.text ?? "" };
    case "tool_call_started": {
      const d = parseData(data);
      return d ? { type: "tool_call_started", name: d.name, arguments: d.arguments } : null;
    }
    case "tool_call_completed": {
      const d = parseData(data);
      return d ? { type: "tool_call_completed", name: d.name, ok: d.ok, result: d.result } : null;
    }
    case "done":
      return { type: "done" };
    case "error":
      return { type: "error", message: parseData(data)?.message ?? "Chat failed." };
    default:
      return null;
  }
}
function parseSseBlock(block) {
  let event = "message";
  const dataLines = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  return { event, data: dataLines.join("\n") };
}
function errorMessage(err, fallback) {
  return err instanceof Error && err.message ? err.message : fallback;
}
var PersonaChatBackend = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  conversationId = null;
  controller = null;
  /** Create the backing conversation once; reuse it for the rest of the session. */
  async ensureConversation() {
    if (this.conversationId) return this.conversationId;
    const convo = await this.opts.authedJson(CONVERSATIONS, {
      method: "POST",
      body: JSON.stringify({
        personaSlug: this.opts.personaSlug,
        // The backend resolves model as persona.model || conversation.model;
        // pass the persona's configured model so an unset persona.model still works.
        model: this.opts.model ?? void 0
      })
    });
    this.conversationId = convo.id;
    return convo.id;
  }
  /** Non-streaming fallback (the chat package prefers sendMessageStream when present). */
  async sendMessage(text) {
    let out = "";
    for await (const evt of this.run(text)) {
      if (evt.type === "token") out += evt.text;
      else if (evt.type === "error") throw new Error(evt.message);
    }
    return out;
  }
  sendMessageStream(text, _history, signal) {
    return this.run(text, signal);
  }
  /**
   * Drive one turn: ensure a conversation, POST the message, stream the reply.
   * Emits status transitions along the way ("think" on send, "respond" on the
   * first token, "retry" on a backend retry) and always clears the status when
   * the turn ends — normal completion, error, or abort.
   */
  async *run(text, signal) {
    try {
      this.opts.onStatus?.("think");
      let id;
      try {
        id = await this.ensureConversation();
      } catch (err) {
        yield { type: "error", message: errorMessage(err, "Couldn't start the conversation.") };
        return;
      }
      this.controller = new AbortController();
      if (signal) {
        if (signal.aborted) this.controller.abort();
        else signal.addEventListener("abort", () => this.controller?.abort(), { once: true });
      }
      let res;
      try {
        res = await this.opts.authedFetch(`${CONVERSATIONS}/${id}/messages`, {
          method: "POST",
          headers: { Accept: "text/event-stream" },
          body: JSON.stringify({ message: text }),
          signal: this.controller.signal
        });
      } catch (err) {
        yield { type: "error", message: errorMessage(err, "The chat request failed.") };
        return;
      }
      const body = res.body;
      if (!body) {
        yield { type: "error", message: "No response stream from the chat backend." };
        return;
      }
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let responded = false;
      try {
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const { event, data } = parseSseBlock(buffer.slice(0, sep));
            buffer = buffer.slice(sep + 2);
            if (event === "status") {
              if (parseData(data)?.phase === "retrying") {
                this.opts.onStatus?.("retry");
              }
              continue;
            }
            if (event === "award") {
              const award = parseData(data);
              if (award) this.opts.onAward?.(award);
              continue;
            }
            const evt = toStreamEvent(event, data);
            if (!evt) continue;
            if (evt.type === "token" && !responded) {
              responded = true;
              this.opts.onStatus?.("respond");
            }
            yield evt;
          }
        }
      } finally {
        reader.releaseLock();
      }
    } finally {
      this.opts.onStatus?.(null);
    }
  }
  destroy() {
    this.controller?.abort();
  }
};
export {
  PersonaChatBackend
};
//# sourceMappingURL=index.js.map