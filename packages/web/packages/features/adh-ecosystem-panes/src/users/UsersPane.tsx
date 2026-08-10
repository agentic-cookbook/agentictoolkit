"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  ecosystemUsersApi,
  type EcosystemUser,
  type EcosystemUserInput,
} from "../api/customers";
import { Users } from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { CreateResourceDialog } from "@agentic-toolkit/resource";
import { ButtonBar } from "@agentic-toolkit/resource";
import { RecordApiButton } from "@agentic-toolkit/api-explorer";
import { useMasterDetailForm } from "@agentic-toolkit/resource";
import { useMasterDetailLevel } from "@agentic-toolkit/resource";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import { UserDetail, userBlank, userToInput, userValidate } from "./UserDetail";

function userDiffers(a: EcosystemUserInput, b: EcosystemUserInput): boolean {
  return (Object.keys(a) as (keyof EcosystemUserInput)[]).some(
    (k) => a[k].trim() !== b[k].trim(),
  );
}

function userNormalize(d: EcosystemUserInput): EcosystemUserInput {
  return {
    email: d.email.trim(),
    displayName: d.displayName.trim(),
    externalId: d.externalId.trim(),
    slug: d.slug.trim(),
    avatarUrl: d.avatarUrl.trim(),
  };
}

/** The Users topic for an ecosystem: the end-customers who authenticate to it
 * (`customer.customers`), as a master/detail list scoped to the ecosystem. */
export function UsersPane({
  ecosystemId,
  help,
  leaf,
}: {
  ecosystemId?: string;
  /** Unused: the breadcrumb names the pane now (kept for the ScopedPane prop shape). */
  title?: ReactNode;
  help?: ReactNode;
  /** Deep-linkable user selection (`…/users/<userId>`); omit for internal. */
  leaf?: TopicLeaf;
}) {
  const [users, setUsers] = useState<EcosystemUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Creating a user is a MODAL over the stack, never a blank leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens it, and on save the new user is selected
  // so its REAL detail (external id, handle, avatar) opens.
  const [newOpen, setNewOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoadError(null);
      setUsers(await ecosystemUsersApi.list(ecosystemId));
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "users-pane", step: "load" });
      setLoadError(err instanceof Error ? err.message : "Failed to load users.");
    }
  }, [ecosystemId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const urlSelection = leaf
    ? { selectedId: leaf.leafId, onSelect: leaf.onSelect }
    : undefined;

  const form = useMasterDetailForm<EcosystemUser, EcosystemUserInput>({
    items: users,
    getId: (u) => u.id,
    urlSelection,
    blank: userBlank,
    toInput: userToInput,
    validate: (draft, others) => userValidate(draft, others.map((o) => o.email)),
    differs: userDiffers,
    normalize: userNormalize,
    create: (input) => ecosystemUsersApi.create(input, ecosystemId ?? ""),
    update: (id, input) => ecosystemUsersApi.update(id, input),
    remove: (u) => ecosystemUsersApi.delete(u.id),
    confirmDelete: (u) =>
      `Delete user "${u.displayName || u.email}"? This cannot be undone.`,
    refresh,
    createLabel: "New user",
  });

  // PUBLISH the users list as a deeper stack level + register the editor's unsaved-work guard.
  useMasterDetailLevel({
    id: "users-list",
    title: "Users",
    form,
    items: users,
    getId: (u) => u.id,
    getLabel: (u) => u.displayName || u.email || "—",
    getSublabel: (u) => u.email || u.externalId || "—",
    itemIcon: <Users size={16} aria-hidden />,
    newLabel: "New user",
    leaf,
    emptyLabel: users === null ? "Loading…" : "No users yet.",
    onNew: () => setNewOpen(true),
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {loadError && <p className="px-6 pt-4 text-sm text-apt-red">{loadError}</p>}
      <ButtonBar
        actions={form.actions}
        showCreate={false}
        trailing={
          <RecordApiButton
            path="/customer/customers/{id}"
            pathValues={{ id: form.selectedId }}
            title="User API"
          />
        }
        help={help}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {form.editing && form.draft ? (
          <UserDetail
            key={form.detailKey}
            title="User"
            draft={form.draft}
            onChange={form.onChange}
            error={form.error}
          />
        ) : (
          <EmptyState
            title={users === null ? "Loading…" : "Select a user to edit, or create a new one."}
          />
        )}
      </div>

      {/* Create is a scoped modal: email + display name only (external id, handle, and
          avatar live in the user's real detail, which opens once the user is selected). */}
      {newOpen && (
        <CreateResourceDialog<EcosystemUserInput, EcosystemUser>
          ariaLabel="New user"
          heading="New user"
          blank={userBlank}
          validate={(d) => userValidate(d, (users ?? []).map((u) => u.email))}
          create={(d) => ecosystemUsersApi.create(userNormalize(d), ecosystemId ?? "")}
          onClose={() => setNewOpen(false)}
          onCreated={(user) => {
            setNewOpen(false);
            void refresh();
            if (leaf) leaf.onSelect(user.id);
            else form.select(user.id);
          }}
          renderForm={(draft, onChange, error) => (
            <>
              <Field label="Email" hint="The identifier this user signs in to the ecosystem with.">
                <Input
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
                  autoFocus
                  type="email"
                  value={draft.email}
                  placeholder="person@example.com"
                  onChange={(e) => onChange({ ...draft, email: e.target.value })}
                />
              </Field>
              <Field label="Display name">
                <Input
                  value={draft.displayName}
                  placeholder="Jane Doe"
                  onChange={(e) => onChange({ ...draft, displayName: e.target.value })}
                />
              </Field>
              {error && <p className="text-sm text-apt-red">{error}</p>}
            </>
          )}
        />
      )}
    </div>
  );
}
