"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";
import {
  EditableList,
  useEditableList,
  type EditableListColumn,
} from "@agenticdevelopertoolkit/ui/blocks";
import { formatDate } from "@agenticdevelopertoolkit/ui/lib/timestamps";

import type { EcosystemUser } from "../api/customers";

/**
 * This ecosystem's end-customers, as the same table the admin site shows its users in — the same
 * {@link EditableList}, the same resizable sortable columns, the same search over every column that
 * has a value, the same "—" for a cell with nothing in it.
 *
 * The same COMPONENT, not a copy of it: the list moved into `@agenticdevelopertoolkit/ui/blocks` when this
 * pane needed it, so the two cannot drift into different tables of the same rows.
 *
 * What is deliberately NOT here is the half of the admin page that is about the platform rather
 * than about a user: the role menu, the capability badges and the ecosystem chips. An ecosystem's
 * customers hold no hub capabilities and belong to exactly one ecosystem — this one — so those
 * three columns would be a menu with one item, a badge nobody carries, and a chip that always says
 * the name already in the breadcrumb. The selection ticks go with them: the row's own detail is
 * what you do to a user here, and the delete for it is already on the detail's bar.
 */
export function UsersTable({
  users,
  error,
  onOpen,
}: {
  /** `null` while the first read is in flight — the table draws its loading state. */
  users: EcosystemUser[] | null;
  /** The read's failure, handed to the list so a failed load never renders as "no users yet." */
  error?: unknown;
  /** Open a user's detail — a double-click, or Enter on the focused row. */
  onOpen: (userId: string) => void;
}): ReactElement {
  const columns: EditableListColumn<EcosystemUser>[] = useMemo(
    () => [
      {
        key: "name",
        header: "User",
        value: (user) => user.displayName,
        render: (user) => (
          <span className="flex items-center gap-2">
            {/* The initial, not the avatar: the same disc the admin page draws. A row here is one
                line tall and the picture would be 20px of a face nobody recognises at that size,
                while the letter does the one job the disc has — telling two adjacent rows apart. */}
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-apt-surface-2 text-[10px] font-medium text-apt-text-muted">
              {(user.displayName || user.email || "?").charAt(0).toUpperCase()}
            </span>
            <span className="truncate font-medium text-apt-text">{user.displayName || "—"}</span>
          </span>
        ),
      },
      {
        key: "email",
        header: "Email",
        value: (user) => user.email,
        render: (user) =>
          user.email ? (
            <span className="font-mono text-xs text-apt-text-muted">{user.email}</span>
          ) : (
            <span className="text-apt-text-dim">—</span>
          ),
      },
      {
        key: "slug",
        header: "Handle",
        value: (user) => user.slug,
        render: (user) =>
          user.slug ? (
            <span className="font-mono text-xs text-apt-text-muted">{user.slug}</span>
          ) : (
            <span className="text-apt-text-dim">—</span>
          ),
      },
      {
        key: "externalId",
        header: "External ID",
        // The id this user carries in the system the ecosystem authenticates them from — the one
        // column here an operator arrives with in hand, from a support ticket or a log line, which
        // is why it is searched as well as shown.
        value: (user) => user.externalId,
        render: (user) =>
          user.externalId ? (
            <span className="font-mono text-xs text-apt-text-muted">{user.externalId}</span>
          ) : (
            <span className="text-apt-text-dim">—</span>
          ),
      },
      {
        key: "joined",
        header: "Joined",
        width: "9rem",
        // Sorted by the RAW timestamp, shown formatted — sorting by "22 Aug 2026" sorts
        // alphabetically by month name. Same reasoning as the admin page's Joined column.
        value: (user) => user.createdAt,
        render: (user) => (
          <span className="text-xs text-apt-text-dim">{formatDate(user.createdAt)}</span>
        ),
      },
    ],
    [],
  );

  const list = useEditableList<EcosystemUser>({
    rows: users ?? undefined,
    getRowId: (user) => user.id,
    columns,
  });

  return (
    <EditableList
      list={list}
      ariaLabel="Users"
      loading={users === null}
      error={error}
      errorTitle="Couldn't load users"
      selectable={false}
      onRowActivate={onOpen}
      columnWidthsKey="ecosystem-users"
      // The email, not the display name: two customers called "Alex" is ordinary, and the email is
      // what the row is actually keyed by.
      describeRow={(user) => user.email || user.id}
      searchPlaceholder="Name, email, handle or id"
      emptyLabel="No users yet."
      emptyFilteredLabel="No users match this search."
    />
  );
}
