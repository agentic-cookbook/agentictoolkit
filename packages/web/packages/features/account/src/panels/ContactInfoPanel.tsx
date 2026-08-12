"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PrivacyLevelSelect } from "@agentic-toolkit/ui/components/privacy-level-select";
import { ContactsCard } from "../notifications/ContactsCard";
import {
  getPrivacyGrants,
  setPrivacyGrant,
  resolvePrivacyLevel,
  PRIVACY_KEY,
  type PrivacyLevel,
} from "@agentic-toolkit/data/profile";
import type { ContactMethod } from "../api/account";

// ── Component ──────────────────────────────────────────────────────────────────

export function ContactInfoPanel() {
  const qc = useQueryClient();

  const privacyQuery = useQuery({
    queryKey: PRIVACY_KEY,
    queryFn: getPrivacyGrants,
    retry: false,
  });

  const grants = privacyQuery.data ?? [];

  const privacyMutation = useMutation({
    mutationFn: ({ id, level }: { id: string; level: PrivacyLevel }) =>
      setPrivacyGrant("contact_methods", id, level),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRIVACY_KEY });
    },
  });

  function rowExtra(contact: ContactMethod) {
    const level = resolvePrivacyLevel(grants, "contact_methods", contact.id);
    const typeLabel = contact.type === "email" ? "Email" : "Phone";
    return (
      <div className="w-36 shrink-0">
        <PrivacyLevelSelect
          value={level}
          onChange={(next) =>
            privacyMutation.mutate({ id: contact.id, level: next })
          }
          ariaLabel={`${typeLabel} ${contact.value} visibility`}
          disabled={privacyMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl">
        <ContactsCard rowExtra={rowExtra} />
      </div>
    </div>
  );
}
