"use client";

import type { ReactElement } from "react";
import { SectionHeader } from "@agentic-toolkit/ui/blocks/section-header";
import { PreferencesCard } from "./PreferencesCard";
import { ContactsCard } from "./ContactsCard";

/**
 * The bespoke /notifications account workspace: notification preferences +
 * contact-method management (verify email/phone). Replaces the generic
 * settings.notifications CRUD table (feature-routes.ts marks it `custom`).
 */
export function NotificationsWorkspace(): ReactElement {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <SectionHeader
        title="Notifications"
        help={
          <p className="text-sm text-apt-text-muted">
            Manage how we contact you. Notification channels respect your verified contacts —
            SMS only sends to a verified phone number.
          </p>
        }
      />
      <PreferencesCard />
      <ContactsCard />
    </div>
  );
}
