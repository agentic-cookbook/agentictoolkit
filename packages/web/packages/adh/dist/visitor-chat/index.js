// src/visitor-chat/sse.ts
function parseData(data) {
  try {
    return JSON.parse(data);
  } catch {
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
      return {
        type: "error",
        message: parseData(data)?.message ?? "Chat failed."
      };
    default:
      return null;
  }
}
async function* readSseBlocks(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const push = (text) => {
    buffer += text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  };
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      push(decoder.decode(value, { stream: true }));
      let sep;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        yield parseSseBlock(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
      }
    }
    push(decoder.decode());
    const tail = buffer.trim();
    if (tail) yield parseSseBlock(tail);
  } finally {
    reader.releaseLock();
  }
}

// src/visitor-chat/index.ts
var EXPIRY_SKEW_MS = 3e4;
var tokenKey = (slug) => `bitbag.visitor.${slug}.token`;
var convoKey = (slug) => `bitbag.visitor.${slug}.conversation`;
var DEFAULT_PERSONA_NAME = "This persona";
var restingMessage = (who) => `${who} is resting right now \u2014 please check back in a little while.`;
var startFailedMessage = (who) => `${who} couldn't start a chat right now. Please try again in a moment.`;
var unavailableMessage = (who) => `${who} isn't available right now.`;
var lengthCapMessage = (max) => max != null ? `This chat has reached its ${max}-message limit. Send another message to start a fresh conversation.` : "This chat has reached its length limit. Send another message to start a fresh conversation.";
var VisitorGateError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "VisitorGateError";
  }
  status;
};
function errorMessage(err, fallback) {
  return err instanceof Error && err.message ? err.message : fallback;
}
function isAbortError(err) {
  return err instanceof Error && err.name === "AbortError";
}
function browserStore() {
  const ls = () => {
    try {
      return typeof window !== "undefined" ? window.localStorage : null;
    } catch {
      return null;
    }
  };
  return {
    get: (k) => {
      try {
        return ls()?.getItem(k) ?? null;
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        ls()?.setItem(k, v);
      } catch {
      }
    },
    remove: (k) => {
      try {
        ls()?.removeItem(k);
      } catch {
      }
    }
  };
}
var AdhChatBackend = class {
  slug;
  apiBase;
  fetchImpl;
  store;
  givenName;
  onBootstrap;
  controller = null;
  bootstrap = null;
  /** The name the bootstrap ACTUALLY carried, kept apart from `bootstrap.personaName` (which
   *  falls back to the slug for its UI consumers) — a raw slug reads like a typo in a sentence. */
  bootstrapName = null;
  bootstrapDone = false;
  constructor(opts) {
    this.slug = opts.personaSlug;
    this.apiBase = (opts.apiBase ?? "/api").replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
    this.store = opts.store ?? browserStore();
    this.givenName = opts.personaName;
    this.onBootstrap = opts.onBootstrap;
  }
  /** The name to put in visitor-facing copy: the bootstrap's (authoritative, but only once a
   *  turn has got that far), else the caller's, else neutral. The gates that produce this copy
   *  are mostly the ones that fail before bootstrap, hence the constructor option. */
  get personaName() {
    return this.bootstrapName ?? this.givenName ?? DEFAULT_PERSONA_NAME;
  }
  // --- token lifecycle -----------------------------------------------------
  /** The stored token, or null when absent/expired (so the caller re-mints). */
  readStoredToken() {
    const rec = parseData(this.store.get(tokenKey(this.slug)) ?? "");
    if (!rec || !rec.token) return null;
    if (rec.expiresAt) {
      const exp = Date.parse(rec.expiresAt);
      if (!Number.isNaN(exp) && exp - EXPIRY_SKEW_MS <= Date.now()) return null;
    }
    return rec;
  }
  /** Mint a fresh visitor token, persist it, and drop any conversation the OLD token owned.
   *
   *  Dropping the id is REQUIRED here, not merely tidy, and it is NOT in tension with the
   *  conversation's own much longer retention window. Server-side a visitor conversation is owned by
   *  the TOKEN ROW that created it (`createVisitorConversation` stamps `visitor_token_id = auth.id`)
   *  and every read is scoped to that id (`getVisitorConversation` filters on it), so the turn route
   *  404s any conversation a DIFFERENT token owns. Each mint inserts a brand-new token row with a new
   *  id — nothing reuses or re-parents one — so a re-mint makes the stored conversation permanently
   *  unreachable however much of its 30-day TTL remains. Keeping the id would buy only a guaranteed
   *  404 on the next turn. See backend routes/visitor.ts + llm/persistence.ts. */
  async mintToken() {
    const res = await this.fetchImpl(
      `${this.apiBase}/public/personas/${encodeURIComponent(this.slug)}/visitor-tokens`,
      { method: "POST", headers: { Accept: "application/json" } }
    );
    if (!res.ok) throw new VisitorGateError(`mint failed (${res.status})`, res.status);
    const body = parseData(await res.text());
    if (!body || !body.token) throw new VisitorGateError("mint returned no token", res.status);
    const rec = {
      token: body.token,
      expiresAt: body.expiresAt ?? null,
      personaId: body.personaId
    };
    this.store.set(tokenKey(this.slug), JSON.stringify(rec));
    this.store.remove(convoKey(this.slug));
    return rec;
  }
  async ensureToken() {
    return this.readStoredToken() ?? await this.mintToken();
  }
  /** Fetch an authed endpoint with the visitor bearer, transparently re-minting the
   *  token once on a 401 (expired/revoked) and retrying the SAME request. The re-mint restarts the
   *  whole anonymous session, conversation included (see {@link mintToken}) — so a 401 on ANY authed
   *  request, the bootstrap read included, correctly abandons the old conversation: it belongs to the
   *  dead token and no request under the new one could ever reach it. */
  async authedFetch(path, init) {
    const withAuth = (token) => ({
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` }
    });
    const rec = await this.ensureToken();
    const res = await this.fetchImpl(`${this.apiBase}${path}`, withAuth(rec.token));
    if (res.status !== 401) return res;
    const fresh = await this.mintToken();
    return this.fetchImpl(`${this.apiBase}${path}`, withAuth(fresh.token));
  }
  // --- bootstrap -----------------------------------------------------------
  /** Read GET /persona/bootstrap once (best-effort). Surfaces the persona's name +
   *  advisory limits; a failure never blocks chatting. */
  async ensureBootstrap() {
    if (this.bootstrapDone) return;
    try {
      const res = await this.authedFetch("/persona/bootstrap", { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const payload = parseData(await res.text());
      if (!payload) return;
      const name = payload.persona?.name?.trim();
      this.bootstrapName = name ? name : null;
      this.bootstrap = {
        personaName: name ? name : this.slug,
        maxConversationLength: payload.chat?.limits?.maxConversationLength ?? null
      };
      this.onBootstrap?.(this.bootstrap);
      this.bootstrapDone = true;
    } catch {
    }
  }
  // --- conversation --------------------------------------------------------
  /** Reuse the stored conversation (a returning visitor resumes), else create one. */
  async ensureConversation() {
    const existing = this.store.get(convoKey(this.slug));
    if (existing) return existing;
    const res = await this.authedFetch("/public/visitor-chat/conversations", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: "{}"
    });
    if (res.status === 503) throw new VisitorGateError("resting", 503);
    if (!res.ok) throw new VisitorGateError(`create conversation failed (${res.status})`, res.status);
    const body = parseData(await res.text());
    if (!body || !body.id) throw new VisitorGateError("create conversation returned no id", res.status);
    this.store.set(convoKey(this.slug), body.id);
    return body.id;
  }
  // --- turn ----------------------------------------------------------------
  turnFetch(id, token, body, signal) {
    return this.fetchImpl(
      `${this.apiBase}/public/visitor-chat/conversations/${encodeURIComponent(id)}/turns`,
      {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body,
        signal
      }
    );
  }
  /** POST the turn, self-healing a stale conversation once:
   *  - 401 → the token is gone; re-mint (which drops the orphaned conversation id),
   *    re-create the conversation under the new token, and retry.
   *  - 404 → the token is still valid but the stored conversation no longer exists
   *    server-side (its retention window elapsed and the reaper deleted it, so the
   *    turn pre-flight 404s). Drop only the dead id, create a fresh conversation, and
   *    retry — otherwise the visitor is stranded forever POSTing to a deleted id. */
  async postTurn(text, signal) {
    const body = JSON.stringify({ message: text });
    const id = await this.ensureConversation();
    const rec = await this.ensureToken();
    const res = await this.turnFetch(id, rec.token, body, signal);
    if (res.status === 401) {
      const fresh = await this.mintToken();
      const newId = await this.ensureConversation();
      return this.turnFetch(newId, fresh.token, body, signal);
    }
    if (res.status === 404) {
      this.store.remove(convoKey(this.slug));
      const newId = await this.ensureConversation();
      return this.turnFetch(newId, rec.token, body, signal);
    }
    return res;
  }
  /** Drive one turn: ensure a token + bootstrap, POST the turn, gate on its HTTP
   *  status, then stream the reply as ChatStreamEvents. */
  async *run(text, signal) {
    try {
      await this.ensureToken();
    } catch (err) {
      yield this.gateErrorEvent(err);
      return;
    }
    await this.ensureBootstrap();
    const controller = new AbortController();
    this.controller = controller;
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      let res;
      try {
        res = await this.postTurn(text, controller.signal);
      } catch (err) {
        if (isAbortError(err)) return;
        yield this.gateErrorEvent(err);
        return;
      }
      if (res.status === 409) {
        this.store.remove(convoKey(this.slug));
        yield { type: "error", message: lengthCapMessage(this.bootstrap?.maxConversationLength ?? null) };
        return;
      }
      if (res.status === 503) {
        yield { type: "error", message: restingMessage(this.personaName) };
        return;
      }
      if (!res.ok || !res.body) {
        yield { type: "error", message: startFailedMessage(this.personaName) };
        return;
      }
      try {
        for await (const { event, data } of readSseBlocks(res.body)) {
          const evt = toStreamEvent(event, data);
          if (evt) yield evt;
        }
      } catch (err) {
        if (isAbortError(err)) return;
        yield { type: "error", message: errorMessage(err, "The chat stream failed.") };
      }
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
  /** Map a gate/network failure to a friendly error event. */
  gateErrorEvent(err) {
    if (err instanceof VisitorGateError) {
      if (err.status === 503) return { type: "error", message: restingMessage(this.personaName) };
      if (err.status === 404) return { type: "error", message: unavailableMessage(this.personaName) };
    }
    return { type: "error", message: startFailedMessage(this.personaName) };
  }
  // --- ChatBackend ---------------------------------------------------------
  /** Non-streaming fallback — the chat package prefers sendMessageStream when present. */
  async sendMessage(text, _history) {
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
  destroy() {
    this.controller?.abort();
  }
};
export {
  AdhChatBackend
};
//# sourceMappingURL=index.js.map