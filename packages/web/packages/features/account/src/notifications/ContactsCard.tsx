"use client";

import { useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@agentic-toolkit/ui/components/card";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Spinner } from "@agentic-toolkit/ui/components/spinner";
import {
  addContact,
  confirmContactVerification,
  deleteContact,
  listContacts,
  startContactVerification,
  type ContactMethod,
} from "../api/account";
import { extractErrorMessage } from "@agentic-toolkit/auth/client";
import { useReportSettingsDirty } from "@agentic-toolkit/resource";

function ContactRow({
  contact,
  onChanged,
  rowExtra,
}: {
  contact: ContactMethod;
  onChanged: () => void;
  /** Optional slot rendered in the action area of each row (e.g. a PrivacyLevelSelect). */
  rowExtra?: (contact: ContactMethod) => ReactNode;
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const start = useMutation({
    mutationFn: () => startContactVerification(contact.id),
    onSuccess: () => setVerifying(true),
  });
  const confirm = useMutation({
    mutationFn: () => confirmContactVerification(contact.id, code.trim()),
    onSuccess: () => {
      setVerifying(false);
      setCode("");
      onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteContact(contact.id),
    onSuccess: onChanged,
  });

  const isPrimaryEmail = contact.isPrimary && contact.type === "email";
  const Icon = contact.type === "email" ? Mail : Phone;

  return (
    <div className="rounded-lg border border-apt-border p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon className="size-4 shrink-0 text-apt-text-muted" aria-hidden />
        <span className="font-mono text-sm text-apt-text">{contact.value}</span>
        {contact.isPrimary && <Badge variant="accent">Primary</Badge>}
        {contact.verified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="orange">Unverified</Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {rowExtra && rowExtra(contact)}
          {!contact.verified && !verifying && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => start.mutate()}
              disabled={start.isPending}
            >
              {start.isPending ? "Sending…" : "Send code"}
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${contact.value}`}
            onClick={() => remove.mutate()}
            disabled={remove.isPending || isPrimaryEmail}
            title={
              isPrimaryEmail ? "Your primary email can’t be removed" : `Remove ${contact.value}`
            }
          >
            <Trash2 className="text-apt-red" />
          </Button>
        </div>
      </div>

      {verifying && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            confirm.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={`code-${contact.id}`} className="text-xs text-apt-text-muted">
              Enter the 6-digit code we sent
            </Label>
            <Input
              id={`code-${contact.id}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="w-32 font-mono"
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={confirm.isPending || code.trim().length === 0}>
            {confirm.isPending ? "Verifying…" : "Verify"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => start.mutate()}
            disabled={start.isPending}
          >
            Resend
          </Button>
        </form>
      )}

      {start.isError && (
        <p className="mt-2 text-xs text-apt-red" role="alert">
          {extractErrorMessage(start.error, "Couldn’t send a code.")}
        </p>
      )}
      {confirm.isError && (
        <p className="mt-2 text-xs text-apt-red" role="alert">
          {extractErrorMessage(confirm.error, "That code didn’t match.")}
        </p>
      )}
      {remove.isError && (
        <p className="mt-2 text-xs text-apt-red" role="alert">
          {extractErrorMessage(remove.error, "Couldn’t remove this contact.")}
        </p>
      )}
    </div>
  );
}

export interface ContactsCardProps {
  /** Optional slot rendered in each row's action area (before Send/Remove).
   *  Receives the ContactMethod so callers can render per-contact controls
   *  (e.g. a PrivacyLevelSelect in the Settings profile panel). */
  rowExtra?: (contact: ContactMethod) => ReactNode;
}

export function ContactsCard({ rowExtra }: ContactsCardProps = {}): ReactElement {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["account", "contacts"],
    queryFn: listContacts,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["account", "contacts"] });

  const [type, setType] = useState<"email" | "phone">("email");
  const [value, setValue] = useState("");

  // The address itself is the typed work; `type` is a two-option selector with a default, so
  // flipping it loses nothing and arming the guard on it would prompt on a free exit. Withdraws
  // when `add` succeeds, since that clears the field. Same key shape as the sibling
  // PreferencesCard on these surfaces — one card, one report.
  useReportSettingsDirty("notification-contacts", value.trim() !== "");

  const add = useMutation({
    mutationFn: () => addContact({ type, value: value.trim() }),
    onSuccess: () => {
      setValue("");
      invalidate();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact methods</CardTitle>
        <CardDescription>
          Add and verify the emails and phone numbers we can reach you on. A verified phone
          unlocks SMS notifications and 2-factor authentication.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-apt-text-muted">
            <Spinner /> Loading contacts…
          </div>
        )}
        {isError && (
          <p className="text-sm text-apt-red" role="alert">
            Couldn’t load your contacts. Reload to try again.
          </p>
        )}
        {data && (
          <>
            {data.length === 0 ? (
              <p className="text-sm text-apt-text-muted">No contacts yet.</p>
            ) : (
              <div className="space-y-2">
                {data.map((c) => (
                  <ContactRow key={c.id} contact={c} onChanged={invalidate} rowExtra={rowExtra} />
                ))}
              </div>
            )}

            <form
              className="flex flex-wrap items-end gap-2 border-t border-apt-border pt-4"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="add-type" className="text-xs text-apt-text-muted">
                  Type
                </Label>
                <Select
                  id="add-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as "email" | "phone")}
                  className="w-28"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="add-value" className="text-xs text-apt-text-muted">
                  {type === "email" ? "Email address" : "Phone number (E.164)"}
                </Label>
                <Input
                  id="add-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === "email" ? "you@example.com" : "+15555550123"}
                  required
                />
              </div>
              <Button type="submit" disabled={add.isPending || value.trim().length === 0}>
                {add.isPending ? "Adding…" : "Add"}
              </Button>
            </form>
            {add.isError && (
              <p className="text-xs text-apt-red" role="alert">
                {extractErrorMessage(add.error, "Couldn’t add that contact.")}
              </p>
            )}
            {type === "phone" && (
              <p className="text-xs leading-relaxed text-apt-text-dim">
                By adding a phone number you agree to receive verification and account-security
                text messages from Agentic Developer Hub. Msg &amp; data rates may apply; message
                frequency varies. Reply STOP to unsubscribe, HELP for help. See our{" "}
                <Link href="/privacy" className="underline hover:text-apt-text-muted">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/terms" className="underline hover:text-apt-text-muted">
                  Terms
                </Link>
                .
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
