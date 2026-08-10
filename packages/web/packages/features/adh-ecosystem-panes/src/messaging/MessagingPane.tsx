"use client";

import { useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { HelpPopover, type TopicLeaf } from "@agentic-toolkit/resource";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { DataTable, type DataTableColumn } from "@agentic-toolkit/ui/components/data-table";
import { Pagination } from "@agentic-toolkit/ui/components/pagination";
import {
  useMessagingStatus,
  useMessagingTemplates,
  useMessageLog,
  useSendMessage,
  type MessagingTemplateList,
  type MessageLogEntry,
} from "../api/messaging";
import { useReportSettingsDirty } from "@agentic-toolkit/resource";

type Template = MessagingTemplateList[number];

/** Union of `{{var}}` placeholders across every field the backend may render. The inner
 *  pattern MUST mirror the backend's missing-variable check (`/\{\{[^}]+\}\}/` in
 *  routes/messaging.ts `resolveMessageContent`): a placeholder captured here becomes a form
 *  field, and every placeholder the backend can detect must be fillable or the send is
 *  rejected as "missing required variables". The captured text is the exact substitution key
 *  the backend splits on, so it is used verbatim (not trimmed). */
function templateVars(t: Template): string[] {
  const text = [t.subject, t.htmlBody, t.textBody, t.smsBody ?? ""].join(" ");
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) if (m[1]) found.add(m[1]);
  return [...found];
}

function ProviderStatusBanner({ ecosystemId, channel }: { ecosystemId?: string; channel: "email" | "sms" }) {
  const { data, isLoading, isError } = useMessagingStatus(ecosystemId);
  // No ecosystem (query disabled) or still loading: nothing to say yet.
  if (!ecosystemId || isLoading) return null;
  const label = channel === "email" ? "Email (Postmark)" : "SMS (Twilio)";
  // A failed status check must NOT be treated as "connected" (the old `!data` early-return
  // hid the banner entirely on error, so an unconfigured channel looked ready). We can't
  // confirm the provider, so warn that sends may fail rather than silently hiding it.
  if (isError || !data) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Couldn’t check whether {label} is connected for this product — sends on this channel may fail.
      </p>
    );
  }
  const configured = channel === "email" ? data.email : data.sms;
  if (configured) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {label} is not connected for this product — sends on this channel will fail. Connect a{" "}
      {channel === "email" ? "Postmark" : "Twilio"} integration on this product's Integrations tab.
    </p>
  );
}

function SendForm({ ecosystemId, help }: { ecosystemId?: string; help?: ReactNode }) {
  const send = useSendMessage(ecosystemId);
  const { data: templates } = useMessagingTemplates();

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
  // kind of work the guard exists for, and `send` only clears the fields on SUCCESS.
  // Deliberately NOT `channel` or `templateId`: both are one-click selections with defaults, so
  // arming the guard on them would nag on an exit that loses nothing typed.
  //
  // `composed` follows the SAME branch the render and `handleSend` take, rather than reading every
  // piece of state: picking a template hides subject/body and stops sending them, and SMS hides the
  // subject. Text stranded behind either switch is invisible on screen AND absent from the payload,
  // so reporting it would prompt about work the user cannot see — the false alarm this hook's
  // contract forbids. It is not cleared, because switching back must bring the draft with it.
  //
  // Keyed by ecosystem because this pane is product-scoped — two products' Send forms are
  // different drafts, and a shared key would let one withdraw the other's report.
  const composed = selected
    ? Object.values(vars).some((v) => v.trim() !== "")
    : body.trim() !== "" || (channel === "email" && subject.trim() !== "");
  const dirty = userId.trim() !== "" || recipient.trim() !== "" || composed;
  useReportSettingsDirty(`messaging-send:${ecosystemId ?? "none"}`, dirty);

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
    const payload = selected
      ? { ...base, templateId: selected.id, templateVars: vars }
      : { ...base, body, ...(channel === "email" && subject ? { subject } : {}) };
    send.mutate(payload, { onSuccess: reset });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Send Message</h2>
          {help && <HelpPopover>{help}</HelpPopover>}
        </div>
        <form onSubmit={handleSend} className="space-y-4">
          <ProviderStatusBanner ecosystemId={ecosystemId} channel={channel} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Channel">
              <Select value={channel} onChange={(e) => setChannel(e.target.value as "email" | "sms")}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Select>
            </Field>
            <Field label="Customer ID">
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
            <Button type="submit" disabled={send.isPending || !ecosystemId}>{send.isPending ? "Sending…" : "Send"}</Button>
            {send.isSuccess && <span className="text-sm text-apt-text-muted" role="status">Sent</span>}
            {send.isError && <span className="text-sm text-destructive" role="alert">Could not send — check the recipient and provider config.</span>}
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

const LOG_COLS: DataTableColumn<MessageLogEntry>[] = [
  { key: "channel", header: "Channel", width: "7rem" },
  { key: "recipient", header: "Recipient", render: (m) => <span className="font-mono text-xs text-apt-text-muted">{m.recipient}</span> },
  { key: "subject", header: "Subject", render: (m) => <span className="text-apt-text-muted">{m.subject ?? "—"}</span> },
  { key: "status", header: "Status", width: "8rem", render: (m) => <Badge variant={statusVariant(m.status)}>{m.status}</Badge> },
  { key: "createdAt", header: "Sent", width: "13rem", render: (m) => <span className="text-xs text-apt-text-muted">{m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}</span> },
];

function MessageLogTable({ ecosystemId }: { ecosystemId?: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMessageLog(ecosystemId, page);
  // The backend paginates ({ items, total, page, pageSize }); derive the bounds so rows past
  // the first page are reachable. Pagination renders nothing when there is only one page.
  const pageSize = data?.pageSize ?? 20;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  return (
    <div className="space-y-3">
      <DataTable<MessageLogEntry>
        columns={LOG_COLS}
        rows={data?.items ?? []}
        getRowId={(m) => String(m.id)}
        loading={isLoading}
        emptyLabel="No messages sent yet."
        ariaLabel="Message log"
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

/**
 * Per-product Messaging: send email/SMS to a customer of THIS ecosystem via its own
 * connected Postmark/Twilio integration, with a scoped message log. Mirrors the admin
 * Messaging tool, scoped to `ecosystemId`. A channel is disabled (banner) until the
 * matching provider is connected on this product's Integrations tab.
 */
export function MessagingPane({
  ecosystemId,
  help,
}: {
  ecosystemId?: string;
  /** Unused: the breadcrumb names the pane (kept for the ScopedPane prop shape). */
  title?: ReactNode;
  /** Contextual help for the feature, surfaced via the "?" popover on the Send heading. */
  help?: ReactNode;
  /** Unused: this pane has no deep-linkable sub-resource (kept for the ScopedPane prop shape). */
  leaf?: TopicLeaf;
}): ReactElement {
  return (
    <div className="space-y-8">
      <SendForm ecosystemId={ecosystemId} help={help} />
      <div className="space-y-3">
        <h2 className="font-semibold">Message Log</h2>
        <MessageLogTable ecosystemId={ecosystemId} />
      </div>
    </div>
  );
}
