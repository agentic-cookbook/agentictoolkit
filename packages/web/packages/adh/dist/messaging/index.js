"use client";

// src/messaging/MessagingSurface.tsx
import { useEffect, useMemo, useState } from "react";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { Textarea } from "@agenticdevelopertoolkit/ui/components/textarea";
import { Badge } from "@agenticdevelopertoolkit/ui/components/badge";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { Alert, AlertDescription } from "@agenticdevelopertoolkit/ui/components/alert";
import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import { Field } from "@agenticdevelopertoolkit/ui/blocks/field";
import { DataTable } from "@agenticdevelopertoolkit/ui/components/data-table";
import { Pagination } from "@agenticdevelopertoolkit/ui/components/pagination";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function templateVars(t) {
  const text = [t.subject, t.htmlBody, t.textBody, t.smsBody ?? ""].join(" ");
  const found = /* @__PURE__ */ new Set();
  for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) if (m[1]) found.add(m[1]);
  return [...found];
}
function ProviderStatusBanner({
  status,
  channel,
  providerSetupHint
}) {
  if (status.isLoading) return null;
  const label = channel === "email" ? "Email (Postmark)" : "SMS (Twilio)";
  if (status.isError || !status.data) {
    return /* @__PURE__ */ jsx(Alert, { variant: "error", children: /* @__PURE__ */ jsxs(AlertDescription, { children: [
      "Couldn\u2019t check whether ",
      label,
      " is connected \u2014 sends on this channel may fail."
    ] }) });
  }
  if (channel === "email" ? status.data.email : status.data.sms) return null;
  return /* @__PURE__ */ jsx(Alert, { variant: "error", children: /* @__PURE__ */ jsxs(AlertDescription, { children: [
    label,
    " is not connected \u2014 sends on this channel will fail. ",
    providerSetupHint(channel)
  ] }) });
}
function SendForm({
  status,
  templates,
  send,
  enabled,
  userIdLabel,
  providerSetupHint,
  headerAccessory,
  onDirtyChange
}) {
  const [channel, setChannel] = useState("email");
  const [userId, setUserId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [vars, setVars] = useState({});
  const selected = useMemo(() => templates?.find((t) => t.id === templateId), [templates, templateId]);
  const neededVars = useMemo(() => selected ? templateVars(selected) : [], [selected]);
  const composed = selected ? Object.values(vars).some((v) => v.trim() !== "") : body.trim() !== "" || channel === "email" && subject.trim() !== "";
  const dirty = userId.trim() !== "" || recipient.trim() !== "" || composed;
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
  function handleSend(e) {
    e.preventDefault();
    const base = { userId, channel, ...recipient ? { recipient } : {} };
    const draft = selected ? { ...base, templateId: selected.id, templateVars: vars } : { ...base, body, ...channel === "email" && subject ? { subject } : {} };
    send.mutate(draft, { onSuccess: reset });
  }
  return /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(CardContent, { className: "space-y-4 p-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold", children: "Send Message" }),
      headerAccessory
    ] }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSend, className: "space-y-4", children: [
      enabled && /* @__PURE__ */ jsx(ProviderStatusBanner, { status, channel, providerSetupHint }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsx(Field, { label: "Channel", children: /* @__PURE__ */ jsxs(Select, { value: channel, onChange: (e) => setChannel(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "email", children: "Email" }),
          /* @__PURE__ */ jsx("option", { value: "sms", children: "SMS" })
        ] }) }),
        /* @__PURE__ */ jsx(Field, { label: userIdLabel, children: /* @__PURE__ */ jsx(Input, { value: userId, onChange: (e) => setUserId(e.target.value), required: true, className: "font-mono", placeholder: "customer id" }) })
      ] }),
      /* @__PURE__ */ jsx(Field, { label: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Recipient override ",
        /* @__PURE__ */ jsxs("span", { className: "text-apt-text-muted", children: [
          "(",
          channel === "sms" ? "required for SMS" : "optional",
          ")"
        ] })
      ] }), children: /* @__PURE__ */ jsx(Input, { value: recipient, onChange: (e) => setRecipient(e.target.value), required: channel === "sms", placeholder: channel === "sms" ? "+15555550123" : "name@example.com" }) }),
      /* @__PURE__ */ jsx(Field, { label: "Content", children: /* @__PURE__ */ jsxs(Select, { value: templateId, onChange: (e) => {
        setTemplateId(e.target.value);
        setVars({});
      }, children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "Freeform message" }),
        templates?.map((t) => /* @__PURE__ */ jsx("option", { value: t.id, children: t.name }, t.id))
      ] }) }),
      selected ? /* @__PURE__ */ jsxs("div", { className: "space-y-3 rounded-lg border border-apt-border bg-apt-surface-2/40 p-3", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-apt-text-muted", children: [
          "Subject preview: ",
          /* @__PURE__ */ jsx("span", { className: "text-apt-text", children: selected.subject })
        ] }),
        neededVars.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-apt-text-muted", children: "This template needs no variables." }) : neededVars.map((v) => /* @__PURE__ */ jsx(Field, { label: v, children: /* @__PURE__ */ jsx(Input, { value: vars[v] ?? "", onChange: (e) => setVars((prev) => ({ ...prev, [v]: e.target.value })), required: true }) }, v))
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        channel === "email" && /* @__PURE__ */ jsx(Field, { label: "Subject", children: /* @__PURE__ */ jsx(Input, { value: subject, onChange: (e) => setSubject(e.target.value), required: true }) }),
        /* @__PURE__ */ jsx(Field, { label: "Message body", children: /* @__PURE__ */ jsx(Textarea, { value: body, onChange: (e) => setBody(e.target.value), required: true, rows: 3 }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx(Button, { type: "submit", disabled: send.isPending || !enabled, children: send.isPending ? "Sending\u2026" : "Send" }),
        send.isSuccess && /* @__PURE__ */ jsx("span", { className: "text-sm text-apt-text-muted", role: "status", children: "Sent" }),
        send.isError && /* @__PURE__ */ jsx(ErrorText, { error: "Could not send \u2014 check the recipient and provider config." })
      ] })
    ] })
  ] }) });
}
function statusVariant(status) {
  if (status === "sent") return "success";
  if (status === "failed") return "error";
  return "neutral";
}
var LOG_COLS = [
  { key: "channel", header: "Channel", width: "7rem" },
  { key: "recipient", header: "Recipient", render: (m) => /* @__PURE__ */ jsx("span", { className: "font-mono text-xs text-apt-text-muted", children: m.recipient }) },
  { key: "subject", header: "Subject", render: (m) => /* @__PURE__ */ jsx("span", { className: "text-apt-text-muted", children: m.subject ?? "\u2014" }) },
  { key: "status", header: "Status", width: "8rem", render: (m) => /* @__PURE__ */ jsx(Badge, { variant: statusVariant(m.status), children: m.status }) },
  { key: "createdAt", header: "Sent", width: "13rem", render: (m) => /* @__PURE__ */ jsx("span", { className: "text-xs text-apt-text-muted", children: m.createdAt ? new Date(m.createdAt).toLocaleString() : "\u2014" }) }
];
function MessageLogTable({ log, page, onPageChange }) {
  const pageSize = log.data?.pageSize || 20;
  const total = log.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsx(
      DataTable,
      {
        columns: LOG_COLS,
        rows: log.data?.items ?? [],
        getRowId: (m) => String(m.id),
        loading: log.isLoading,
        emptyLabel: "No messages sent yet.",
        ariaLabel: "Message log"
      }
    ),
    /* @__PURE__ */ jsx(Pagination, { page, totalPages, onPageChange })
  ] });
}
function MessagingSurface({
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
  onDirtyChange
}) {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-8", children: [
    /* @__PURE__ */ jsx(
      SendForm,
      {
        status,
        templates,
        send,
        enabled,
        userIdLabel,
        providerSetupHint,
        headerAccessory,
        onDirtyChange
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx("h2", { className: "font-semibold", children: "Message Log" }),
      /* @__PURE__ */ jsx(MessageLogTable, { log, page, onPageChange })
    ] })
  ] });
}
export {
  MessagingSurface
};
//# sourceMappingURL=index.js.map