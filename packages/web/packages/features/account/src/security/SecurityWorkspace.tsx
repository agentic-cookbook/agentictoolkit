"use client";

import { useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@agenticdevelopertoolkit/ui/components/card";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Label } from "@agenticdevelopertoolkit/ui/components/label";
import { Badge } from "@agenticdevelopertoolkit/ui/components/badge";
import { List, ListItem } from "@agenticdevelopertoolkit/ui/components/list";
import { EmptyState } from "@agenticdevelopertoolkit/ui/components/empty-state";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { Spinner } from "@agenticdevelopertoolkit/ui/components/spinner";
import { SectionHeader } from "@agenticdevelopertoolkit/ui/blocks/section-header";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { RecordApiButton } from "@agentic-toolkit/api-explorer";
import {
  confirmTotp,
  enrollTotp,
  getMfaStatus,
  listWebauthn,
  regenerateRecoveryCodes,
  registerWebauthn,
  removeTotp,
  removeWebauthn,
  setPreferredMethod,
  type MfaStatus,
  type PreferredMethod,
} from "@agentic-toolkit/auth";
import { extractErrorMessage } from "@agentic-toolkit/auth/client";

const MFA_KEY = ["account", "mfa"] as const;

function StatusRow({ on, label }: { on: boolean; label: string }): ReactElement {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-apt-text">{label}</span>
      {on ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}
    </div>
  );
}

function TotpCard({ status }: { status: MfaStatus }): ReactElement {
  const qc = useQueryClient();
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: MFA_KEY });

  const enroll = useMutation({
    mutationFn: enrollTotp,
    onSuccess: (e) => setSecret(e.secret),
  });
  const confirm = useMutation({
    mutationFn: () => confirmTotp(code.trim()),
    onSuccess: () => {
      setSecret(null);
      setCode("");
      invalidate();
    },
  });
  const remove = useMutation({ mutationFn: removeTotp, onSuccess: invalidate });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-apt-text-muted" /> Authenticator app
        </CardTitle>
        <CardDescription>
          Use a TOTP app (1Password, Google Authenticator…) to generate sign-in codes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.totp ? (
          <div className="flex items-center gap-3">
            <Badge variant="success">Enabled</Badge>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Remove
            </Button>
          </div>
        ) : secret ? (
          <div className="space-y-3">
            <p className="text-sm text-apt-text-muted">
              Add this secret to your authenticator, then enter the 6-digit code it shows.
            </p>
            <code className="block rounded-md border border-apt-border bg-apt-surface-2 px-3 py-2 font-mono text-sm tracking-widest text-apt-text">
              {secret}
            </code>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="totp-code" className="text-xs text-apt-text-muted">
                  6-digit code
                </Label>
                <Input
                  id="totp-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-32 font-mono"
                />
              </div>
              <Button onClick={() => confirm.mutate()} disabled={confirm.isPending || code.trim().length === 0}>
                {confirm.isPending ? "Verifying…" : "Verify & enable"}
              </Button>
            </div>
            {confirm.isError && (
              <ErrorText error={extractErrorMessage(confirm.error, "That code didn’t match.")} className="text-xs" />
            )}
          </div>
        ) : (
          <Button onClick={() => enroll.mutate()} disabled={enroll.isPending}>
            {enroll.isPending ? "Starting…" : "Set up authenticator"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PasskeysCard(): ReactElement {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["account", "webauthn"], queryFn: listWebauthn });
  const [name, setName] = useState("");
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["account", "webauthn"] });
    qc.invalidateQueries({ queryKey: MFA_KEY });
  };
  const register = useMutation({
    mutationFn: (kind: "passkey" | "security_key") => registerWebauthn(kind, name.trim() || "My device"),
    onSuccess: () => {
      setName("");
      invalidate();
    },
  });
  const remove = useMutation({ mutationFn: removeWebauthn, onSuccess: invalidate });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-apt-text-muted" /> Passkeys & security keys
        </CardTitle>
        <CardDescription>
          Sign in with a passkey (Face ID, Touch ID, Windows Hello) or a hardware security key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data && data.items.length > 0 ? (
          <List>
            {data.items.map((cred) => (
              <ListItem key={cred.id} className="justify-between py-2">
                <span className="flex items-center gap-2 text-sm text-apt-text">
                  {cred.name || "Unnamed"}
                  <Badge variant="neutral">{cred.kind === "security_key" ? "Security key" : "Passkey"}</Badge>
                </span>
                <Button
                  size="sm"
                  variant="destructive-ghost"
                  onClick={() => remove.mutate(cred.id)}
                  disabled={remove.isPending}
                >
                  Remove
                </Button>
              </ListItem>
            ))}
          </List>
        ) : (
          /* No action slot: the "Add passkey" / "Add security key" pair is the very
             next thing in this card, so a button here would point at itself. */
          <EmptyState
            title="No passkeys or security keys yet."
            description="Name a device below and register it to sign in without a password."
          />
        )}
        <div className="flex flex-wrap items-end gap-2 border-t border-apt-border pt-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="cred-name" className="text-xs text-apt-text-muted">
              Device name
            </Label>
            <Input id="cred-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="MacBook" />
          </div>
          <Button onClick={() => register.mutate("passkey")} disabled={register.isPending}>
            Add passkey
          </Button>
          <Button variant="outline" onClick={() => register.mutate("security_key")} disabled={register.isPending}>
            Add security key
          </Button>
        </div>
        {register.isError && (
          <ErrorText error={extractErrorMessage(register.error, "Registration was cancelled or failed.")} className="text-xs" />
        )}
      </CardContent>
    </Card>
  );
}

function RecoveryCard({ status }: { status: MfaStatus }): ReactElement {
  const qc = useQueryClient();
  const regen = useMutation({
    mutationFn: regenerateRecoveryCodes,
    onSuccess: () => qc.invalidateQueries({ queryKey: MFA_KEY }),
  });
  // Derive the freshly-generated codes from the mutation result rather than mirroring
  // them into separate state (they reset automatically on the next regenerate).
  const codes = regen.data?.codes ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recovery codes</CardTitle>
        <CardDescription>
          One-time codes to sign in if you lose your other factors. {status.recoveryRemaining} unused.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {codes && (
          <div className="space-y-2 rounded-lg border border-apt-gold/40 bg-apt-gold/10 p-3">
            <p className="text-sm text-apt-text">
              Save these now — they won’t be shown again. Each works once.
            </p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-apt-text">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        <Button onClick={() => regen.mutate()} disabled={regen.isPending} variant="outline">
          {status.recoveryRemaining > 0 ? "Regenerate codes" : "Generate codes"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PreferredMethodCard({ status }: { status: MfaStatus }): ReactElement {
  const qc = useQueryClient();
  const available: PreferredMethod[] = (["totp", "sms", "webauthn"] as const).filter(
    (m) => status[m],
  );
  const save = useMutation({
    mutationFn: (m: PreferredMethod) => setPreferredMethod(m),
    onSuccess: () => qc.invalidateQueries({ queryKey: MFA_KEY }),
  });
  if (available.length === 0) return <></>;

  const labels: Record<PreferredMethod, string> = {
    totp: "Authenticator app",
    sms: "Text message (SMS)",
    webauthn: "Passkey / security key",
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferred 2FA method</CardTitle>
        <CardDescription>Which factor we offer first at sign-in.</CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          aria-label="Preferred 2FA method"
          value={status.preferredMethod ?? ""}
          onChange={(e) => {
            if (e.target.value) save.mutate(e.target.value as PreferredMethod);
          }}
          className="max-w-xs"
        >
          {!status.preferredMethod && <option value="">Choose a method…</option>}
          {available.map((m) => (
            <option key={m} value={m}>
              {labels[m]}
            </option>
          ))}
        </Select>
      </CardContent>
    </Card>
  );
}

export function SecurityWorkspace(): ReactElement {
  const { data, isLoading, isError } = useQuery({ queryKey: MFA_KEY, queryFn: getMfaStatus });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <SectionHeader
        title="Security"
        actions={
          <RecordApiButton path="/account/mfa" pathValues={{}} title="Security (MFA) API" />
        }
        help={
          <p className="text-sm text-apt-text-muted">
            Manage two-factor authentication and sign-in methods. Add a second factor to protect
            your account.
          </p>
        }
      />
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-apt-text-muted">
          <Spinner /> Loading…
        </div>
      )}
      {isError && (
        <ErrorText error="Couldn’t load your security settings. Reload to try again." />
      )}
      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>
                {data.sms || data.totp || data.webauthn
                  ? "Two-factor authentication is on."
                  : "Add a second factor to require more than a password at sign-in."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatusRow on={data.totp} label="Authenticator app" />
              <StatusRow on={data.sms} label="Text message (SMS)" />
              <StatusRow on={data.webauthn} label="Passkeys / security keys" />
              <div className="flex items-center gap-2 pt-2 text-xs text-apt-text-dim">
                <Smartphone className="size-3.5" />
                Manage phone numbers on the Notifications page.
              </div>
            </CardContent>
          </Card>
          <TotpCard status={data} />
        </>
      )}
      {/* OUTSIDE the `data &&` gate, deliberately: PasskeysCard reads neither `data` nor any
          other MFA-status field — it runs its own ["account","webauthn"] query and manages a
          sign-in method that works with no second factor configured at all. Gated on the MFA
          status, a failing (or merely slow) /account/mfa took the entire passkey surface with
          it, so a user whose MFA status 500s could not add, name, or REMOVE a passkey — the
          one recovery path that does not need a password. It sits between the two gated
          groups so the card order is unchanged whenever the status does load. */}
      <PasskeysCard />
      {data && (
        <>
          {/* Recovery codes are a fallback for a primary factor — only once one exists. */}
          {(data.sms || data.totp || data.webauthn) && <RecoveryCard status={data} />}
          <PreferredMethodCard status={data} />
        </>
      )}
    </div>
  );
}
