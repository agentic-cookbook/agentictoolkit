"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { Textarea } from "@agenticdevelopertoolkit/ui/components/textarea";
import { Badge } from "@agenticdevelopertoolkit/ui/components/badge";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { Alert, AlertDescription } from "@agenticdevelopertoolkit/ui/components/alert";
import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import { Field } from "@agenticdevelopertoolkit/ui/blocks/field";
import { DataTable, type DataTableColumn } from "@agenticdevelopertoolkit/ui/components/data-table";
import { Pagination } from "@agenticdevelopertoolkit/ui/components/pagination";

/**
 * The Messaging compose form + log, once, for both scopes that have one.
 *
 * There are two messaging BACKENDS — `/messaging/{status,log,send}` (admin, platform-wide)
 * and `/messaging/ecosystems/:id/{status,log,send}` (one product's own Postmark/Twilio) —
 * and they answer with the SAME OpenAPI components (`MessagingStatus`, `MessagingLogPage`,
 * `MessagingTemplate`), so the only thing that differed between the two screens was which
 * URL the hooks called. That difference stays with each host; everything a reader sees
 * lives here. The two used to be forked copies, and had already drifted apart in four ways
 * (docs/ui/fleet-ui-audit.md, Tier 6).
 *
 * The data arrives as plain props rather than as hooks this module calls, because the query
 * keys, the enabled-conditions and the invalidation are the host's — and because a hook prop
 * would make the number of hooks this component runs depend on which host mounted it.
 *
 * Unrelated to `@agentic-toolkit/messaging`, which is in-app messaging between users
 * (notifications, DMs, presence). This is the OUTBOUND tool: email/SMS to a person, through
 * a Postmark/Twilio account, with a log of what was sent.
 */

/** Whether each channel's provider is connected. Structural subset of `MessagingStatus`. */
export interface MessagingProviderStatus {
  email: boolean;
  sms: boolean;
}

/** Structural subset of `MessagingTemplate` — the fields the form reads or substitutes into. */
export interface MessagingTemplateSummary {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  smsBody?: string | null;
}

/** Structural subset of `MessagingLogEntry` — the five columns the log shows. */
export interface MessagingLogRow {
  id: string;
  channel: string;
  recipient: string;
  subject?: string | null;
  status: string;
  createdAt?: string | null;
}

/** Structural subset of `MessagingLogPage`. `total` + `pageSize` are what bound the pager. */
export interface MessagingLogPageData {
  items: MessagingLogRow[];
  total: number;
  pageSize: number;
}

/**
 * What the form hands back on submit. Assignable to BOTH backends' request bodies — they
 * declare the same seven fields — so each host passes it straight to its own mutation and
 * the compiler is what checks that claim stays true.
 */
export interface SendMessageDraft {
  userId: string;
  channel: "email" | "sms";
  recipient?: string;
  subject?: string;
  body?: string;
  templateId?: string;
  templateVars?: Record<string, string>;
}

/**
 * Union of `{{var}}` placeholders across every field the backend may render. The inner
 * pattern MUST mirror the backend's missing-variable check (`/\{\{[^}]+\}\}/` in
 * routes/messaging.ts `resolveMessageContent`): a placeholder captured here becomes a form
 * field, and every placeholder the backend can detect must be fillable or the send is
 * rejected as "missing required variables". The captured text is the exact substitution key
 * the backend splits on, so it is used verbatim (not trimmed).
 */
function templateVars(t: MessagingTemplateSummary): string[] {
  const text = [t.subject, t.htmlBody, t.textBody, t.smsBody ?? ""].join(" ");
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) if (m[1]) found.add(m[1]);
  return [...found];
}

function ProviderStatusBanner({
  status,
  channel,
  providerSetupHint,
}: {
  status: MessagingSurfaceProps["status"];
  channel: "email" | "sms";
  providerSetupHint: (channel: "email" | "sms") => ReactNode;
}) {
  if (status.isLoading) return null;
  const label = channel === "email" ? "Email (Postmark)" : "SMS (Twilio)";
  // A failed status check must NOT be treated as "connected" — an early return on `!data`
  // hides the banner entirely on error, so an unconfigured channel looks ready. We can't
  // confirm the provider, so warn that sends may fail rather than silently hiding it.
  // `Alert variant="error"` is the platform's callout for exactly this — a bordered tonal box
  // that carries its own `role="alert"`. A hand-rolled `<p>` here would be a second treatment
  // for the same thing, drifting from every sibling pane (FeatureFlagsPane's load failure) the
  // first time the tokens move.
  if (status.isError || !status.data) {
    return (
      <Alert variant="error">
        <AlertDescription>
          Couldn’t check whether {label} is connected — sends on this channel may fail.
        </AlertDescription>
      </Alert>
    );
  }
  if (channel === "email" ? status.data.email : status.data.sms) return null;
  return (
    <Alert variant="error">
      <AlertDescription>
        {label} is not connected — sends on this channel will fail. {providerSetupHint(channel)}
      </AlertDescription>
    </Alert>
  );
}

function SendForm({
  status,
  templates,
  send,
  enabled,
  userIdLabel,
  providerSetupHint,
  headerAccessory,
  onDirtyChange,
}: Pick<
  MessagingSurfaceProps,
  "status" | "templates" | "send" | "enabled" | "userIdLabel" | "providerSetupHint" | "headerAccessory" | "onDirtyChange"
>) {
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [userId, setUserId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [templateId, setTemplateId] = useState(""); // "" = freeform
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});

  const selected = useMemo(() => templates?.find((t) => t.id === templateId), [templates, templateId]);
  const neededVars = useMemo(() => (selected ? templateVars(selected) : []), [selected]);

  // A compose form's baseline is empty, so the diff against it is simply "the user has typed
  // something an exit would throw away" — a half-written message to a customer is exactly the
  // kind of work a nav guard exists for, and `send` only clears the fields on SUCCESS.
  // Deliberately NOT `channel` or `templateId`: both are one-click selections with defaults, so
  // arming the guard on them would nag on an exit that loses nothing typed.
  //
  // `composed` follows the SAME branch the render and `handleSend` take, rather than reading every
  // piece of state: picking a template hides subject/body and stops sending them, and SMS hides the
  // subject. Text stranded behind either switch is invisible on screen AND absent from the payload,
  // so reporting it would prompt about work the user cannot see. It is not cleared, because
  // switching back must bring the draft with it.
  const composed = selected
    ? Object.values(vars).some((v) => v.trim() !== "")
    : body.trim() !== "" || (channel === "email" && subject.trim() !== "");
  const dirty = userId.trim() !== "" || recipient.trim() !== "" || composed;
  // Reported UP rather than registered here, because the registration is scoped (per product,
  // per host) and the scope is the host's fact — the same reason the queries are.
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function reset() {
    setUserId("");
    setRecipient("");
    setSubject("");
    setBody("");
    setVars({});
    setTemplateId("");
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const base = { userId, channel, ...(recipient ? { recipient } : {}) };
    const draft: SendMessageDraft = selected
      ? { ...base, templateId: selected.id, templateVars: vars }
      : { ...base, body, ...(channel === "email" && subject ? { subject } : {}) };
    send.mutate(draft, { onSuccess: reset });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Send Message</h2>
          {headerAccessory}
        </div>
        <form onSubmit={handleSend} className="space-y-4">
          {enabled && (
            <ProviderStatusBanner status={status} channel={channel} providerSetupHint={providerSetupHint} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Channel">
              <Select value={channel} onChange={(e) => setChannel(e.target.value as "email" | "sms")}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Select>
            </Field>
            <Field label={userIdLabel}>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} required className="font-mono" placeholder="customer id" />
            </Field>
          </div>
          <Field label={<>Recipient override <span className="text-apt-text-muted">({channel === "sms" ? "required for SMS" : "optional"})</span></>}>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} required={channel === "sms"} placeholder={channel === "sms" ? "+15555550123" : "name@example.com"} />
          </Field>
          <Field label="Content">
            <Select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setVars({}); }}>
              <option value="">Freeform message</option>
              {templates?.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </Select>
          </Field>
          {selected ? (
            <div className="space-y-3 rounded-lg border border-apt-border bg-apt-surface-2/40 p-3">
              <p className="text-sm text-apt-text-muted">Subject preview: <span className="text-apt-text">{selected.subject}</span></p>
              {neededVars.length === 0 ? (
                <p className="text-sm text-apt-text-muted">This template needs no variables.</p>
              ) : (
                neededVars.map((v) => (
                  <Field key={v} label={v}>
                    <Input value={vars[v] ?? ""} onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))} required />
                  </Field>
                ))
              )}
            </div>
          ) : (
            <>
              {channel === "email" && (
                <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} required /></Field>
              )}
              <Field label="Message body"><Textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} /></Field>
            </>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={send.isPending || !enabled}>{send.isPending ? "Sending…" : "Send"}</Button>
            {send.isSuccess && <span className="text-sm text-apt-text-muted" role="status">Sent</span>}
            {send.isError && <ErrorText error="Could not send — check the recipient and provider config." />}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function statusVariant(status: string): "success" | "error" | "neutral" {
  if (status === "sent") return "success";
  if (status === "failed") return "error";
  return "neutral";
}

const LOG_COLS: DataTableColumn<MessagingLogRow>[] = [
  { key: "channel", header: "Channel", width: "7rem" },
  { key: "recipient", header: "Recipient", render: (m) => <span className="font-mono text-xs text-apt-text-muted">{m.recipient}</span> },
  { key: "subject", header: "Subject", render: (m) => <span className="text-apt-text-muted">{m.subject ?? "—"}</span> },
  { key: "status", header: "Status", width: "8rem", render: (m) => <Badge variant={statusVariant(m.status)}>{m.status}</Badge> },
  { key: "createdAt", header: "Sent", width: "13rem", render: (m) => <span className="text-xs text-apt-text-muted">{m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}</span> },
];

function MessageLogTable({ log, page, onPageChange }: Pick<MessagingSurfaceProps, "log" | "page" | "onPageChange">) {
  // The backend paginates ({ items, total, page, pageSize }); derive the bounds so rows past
  // the first page are reachable. Pagination renders nothing when there is only one page.
  // Both fields are defaulted rather than read straight off `data`: a page body missing
  // either one yields NaN, and NaN fails `totalPages <= 1`, so the pager would render
  // "Page 1 of NaN" — a broken control on the one payload that has nothing to page over.
  const pageSize = log.data?.pageSize || 20;
  const total = log.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="space-y-3">
      <DataTable<MessagingLogRow>
        columns={LOG_COLS}
        rows={log.data?.items ?? []}
        getRowId={(m) => String(m.id)}
        loading={log.isLoading}
        emptyLabel="No messages sent yet."
        ariaLabel="Message log"
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}

export interface MessagingSurfaceProps {
  /** The provider-status query, already scoped by the host. */
  status: { data?: MessagingProviderStatus; isLoading: boolean; isError: boolean };
  /** The shared static template list; `undefined` while it loads. */
  templates: readonly MessagingTemplateSummary[] | undefined;
  /** The send mutation. `mutate` is called with a draft assignable to the host's request body. */
  send: {
    mutate: (draft: SendMessageDraft, options?: { onSuccess?: () => void }) => void;
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
  };
  /** The message-log page query for `page`. */
  log: { data?: MessagingLogPageData; isLoading: boolean };
  /** Current log page (1-based). Held by the host because its log query is keyed on it. */
  page: number;
  onPageChange: (page: number) => void;
  /**
   * Whether there is a target to send to at all. `false` means the host has no scope yet
   * (its queries are disabled), so the Send button is disabled and no provider banner shows —
   * "not connected" would be a claim about a product nobody has chosen. Defaults to true.
   */
  enabled?: boolean;
  /** Caption for the recipient's account id — the word differs by scope. Defaults to "Customer ID". */
  userIdLabel?: ReactNode;
  /** How to connect the missing provider. The route differs by scope, so the host says it. */
  providerSetupHint: (channel: "email" | "sms") => ReactNode;
  /** Rendered beside the "Send Message" heading — e.g. a help popover. */
  headerAccessory?: ReactNode;
  /** Called whenever the compose form gains or loses typed work an exit would discard. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function MessagingSurface({
  status,
  templates,
  send,
  log,
  page,
  onPageChange,
  enabled = true,
  userIdLabel = "Customer ID",
  providerSetupHint,
  headerAccessory,
  onDirtyChange,
}: MessagingSurfaceProps): ReactElement {
  return (
    <div className="space-y-8">
      <SendForm
        status={status}
        templates={templates}
        send={send}
        enabled={enabled}
        userIdLabel={userIdLabel}
        providerSetupHint={providerSetupHint}
        headerAccessory={headerAccessory}
        onDirtyChange={onDirtyChange}
      />
      <div className="space-y-3">
        <h2 className="font-semibold">Message Log</h2>
        <MessageLogTable log={log} page={page} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
