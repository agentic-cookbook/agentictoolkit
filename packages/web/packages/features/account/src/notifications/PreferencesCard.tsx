"use client";

import { useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@agentic-toolkit/ui/components/card";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Switch } from "@agentic-toolkit/ui/components/switch";
import { Spinner } from "@agentic-toolkit/ui/components/spinner";
import { RecordApiButton } from "@agentic-toolkit/api-explorer";
import { useReportSettingsDirty } from "@agentic-toolkit/resource";
import {
  listPreferences,
  savePreferences,
  type NotificationPref,
  type NotificationPrefInput,
} from "../api/account";

// Human labels for the backend categories (must cover lib/notificationCategories.ts —
// an unmapped category falls back to rendering its raw enum string as the title, so a category
// added there and forgotten here reads as `project_due` on the settings page rather than
// failing anywhere a build would catch).
const CATEGORY_LABELS: Record<string, { title: string; blurb: string }> = {
  account: {
    title: "Account & security",
    blurb: "Sign-in alerts, password changes, and verification codes.",
  },
  community_reply: {
    title: "Replies",
    blurb: "When someone replies to a thread you started.",
  },
  community_mention: {
    title: "Mentions",
    blurb: "When someone @-mentions you in the community.",
  },
  admin_announcement: {
    title: "Announcements",
    blurb: "Product news and announcements from the team.",
  },
  direct_message: {
    title: "Direct messages",
    blurb: "When someone sends you a direct message.",
  },
  project_assigned: {
    title: "Work assigned to you",
    blurb: "When someone puts a work item in your hands.",
  },
  project_mention: {
    title: "Project mentions",
    blurb: "When someone @-mentions you on a work item.",
  },
  project_comment: {
    title: "Work item comments",
    blurb: "When someone comments on an item you filed or hold.",
  },
  project_status: {
    title: "Work item status",
    blurb: "When an item you filed or hold moves to a new column.",
  },
  project_due: {
    title: "Due dates",
    blurb: "When an item you filed or hold is due today, or has gone overdue.",
  },
};

type Channel = "email" | "sms";
type Override = Partial<Record<Channel, boolean>>;

export function PreferencesCard(): ReactElement {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["account", "preferences"],
    queryFn: listPreferences,
  });
  // User edits live here; the displayed value is override ?? server value, so we
  // never sync server data into state with an effect.
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  const save = useMutation({
    mutationFn: (prefs: NotificationPrefInput[]) => savePreferences(prefs),
    onSuccess: (prefs) => {
      qc.setQueryData(["account", "preferences"], prefs);
      setOverrides({});
    },
  });

  function valueOf(p: NotificationPref, ch: Channel): boolean {
    return overrides[p.category]?.[ch] ?? p[ch];
  }
  function toggle(category: string, ch: Channel, next: boolean) {
    // Clear the prior save's success state on any edit, so the "Saved" note
    // can't reappear when a toggle is flipped back to its saved value.
    if (save.isSuccess) save.reset();
    setOverrides((prev) => ({ ...prev, [category]: { ...prev[category], [ch]: next } }));
  }

  // A real diff of the displayed value against the loaded row, so a toggle flipped and flipped
  // back reports clean. `undefined` while the query is in flight — nothing is loaded, so nothing
  // can be unsaved.
  const dirty = data?.some((p) => valueOf(p, "email") !== p.email || valueOf(p, "sms") !== p.sms);

  // NotificationsWorkspace renders this card bare — there is no enclosing form whose dirty state
  // covers these toggles, so without this report every exit silently drops them.
  useReportSettingsDirty("notification-preferences", dirty === true);

  function onSave() {
    if (!data) return;
    // The loaded row, with the two fields this card edits replaced — not a literal rebuilt from
    // the fields it happens to know about. A save has to carry every field the request requires,
    // and this card owns exactly two of them; the rest ride along at the values they were served
    // at, which is what "I did not touch that" means over a whole-row PUT. Spelling them out
    // instead made the arrival of `inApp` a compile error here, in a card that has no opinion
    // about in-app delivery and no honest value to supply for it.
    save.mutate(
      data.map((p) => ({ ...p, email: valueOf(p, "email"), sms: valueOf(p, "sms") })),
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Notification preferences</CardTitle>
          <RecordApiButton
            path="/notifications/preferences"
            pathValues={{}}
            title="Notification preferences API"
          />
        </div>
        <CardDescription>
          Choose how you hear from us. SMS needs a verified phone number below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-apt-text-muted">
            <Spinner /> Loading preferences…
          </div>
        )}
        {isError && (
          <p className="text-sm text-apt-red" role="alert">
            Couldn’t load your preferences. Reload to try again.
          </p>
        )}
        {data && (
          <div className="space-y-1">
            <div className="hidden grid-cols-[1fr_auto_auto] items-center gap-x-6 px-1 pb-2 text-[0.7rem] font-mono uppercase tracking-wider text-apt-text-dim sm:grid">
              <span />
              <span className="w-12 text-center">Email</span>
              <span className="w-12 text-center">SMS</span>
            </div>
            {data.map((p) => {
              const label = CATEGORY_LABELS[p.category] ?? {
                title: p.category,
                blurb: "",
              };
              return (
                <div
                  key={p.category}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-2 rounded-lg px-1 py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium text-apt-text">{label.title}</div>
                    {label.blurb && (
                      <div className="text-xs text-apt-text-muted">{label.blurb}</div>
                    )}
                  </div>
                  <div className="flex w-12 justify-center">
                    <Switch
                      aria-label={`${label.title} email`}
                      checked={valueOf(p, "email")}
                      onCheckedChange={(v) => toggle(p.category, "email", v)}
                    />
                  </div>
                  <div className="flex w-12 justify-center">
                    <Switch
                      aria-label={`${label.title} SMS`}
                      checked={valueOf(p, "sms")}
                      onCheckedChange={(v) => toggle(p.category, "sms", v)}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-3 pt-4">
              <Button onClick={onSave} disabled={!dirty || save.isPending}>
                {save.isPending ? "Saving…" : "Save preferences"}
              </Button>
              {save.isSuccess && !dirty && (
                <span className="text-sm text-apt-text-muted" role="status">
                  Saved
                </span>
              )}
              {save.isError && (
                <span className="text-sm text-apt-red" role="alert">
                  Couldn’t save — try again.
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
