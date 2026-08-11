import * as React from "react"
import { within } from "@testing-library/react"
import { expect } from "vitest"

import { checkbox, rdid, select, text, textarea } from "../descriptors"
import type { EditingAlertProps, EditingHost } from "../host"
import { dangerZone, section } from "../sections"

/**
 * The fixture is the surface that reported the bug: a Team settings pane whose
 * stored `identifier` ("participants") fails the pane's own reverse-domain rule,
 * which pinned Save grey forever and warned about nothing on the way out.
 */

export interface Team {
  displayName: string
  identifier: string
  archived: boolean
}

export interface TeamContext {
  orgSlug: string
}

export const RDID_RE = /^[a-z0-9]+(\.[a-z0-9-]+)+$/
export const RDID_MESSAGE = "Use reverse-domain form, e.g. com.example.platform."

export const teamFields = {
  displayName: text({ label: "Display name", required: true }),
  identifier: rdid<TeamContext>({
    label: "Identifier",
    hint: "Unique reverse-domain string.",
    validate: (value) => (RDID_RE.test(value) ? null : RDID_MESSAGE),
    repair: (value, context) => `${context.orgSlug}.${value}`,
  }),
  archived: checkbox({ label: "Archived" }),
}

export const teamSections = [
  section("Team", ["displayName", "identifier"]),
  dangerZone(["archived"]),
]

export interface Note {
  title: string
  body: string
  visibility: "private" | "team" | "public"
}

export const noteFields = {
  title: text({ label: "Title", required: true }),
  body: textarea({ label: "Body", rows: 4 }),
  visibility: select({
    label: "Visibility",
    options: [
      { value: "private", label: "Private" },
      { value: "team", label: "Team" },
      { value: "public", label: "Public" },
    ],
  }),
}

export const noteSections = [section("Note", ["title", "body", "visibility"])]

/**
 * A host that puts its two obligations in the DOM instead of behind a spy, so the
 * assertions read the same way a user's outcome does: is the guard armed, and what
 * does the alert say. `guard.test.tsx` covers the REAL host against the platform
 * registry — this one isolates the container's own decisions.
 */
export const testHost: EditingHost = {
  UnsavedChangesGuard: ({ when }: { when: boolean }) => (
    <div data-testid="nav-guard" data-armed={when ? "yes" : "no"} />
  ),
  Alert: ({ open, title, description, tone, confirmLabel, busy, onConfirm }: EditingAlertProps) =>
    open ? (
      <div role="dialog" data-testid="alert" data-tone={tone} data-busy={busy ? "yes" : "no"}>
        <p data-testid="alert-title">{title}</p>
        {description ? <p data-testid="alert-description">{description}</p> : null}
        <button type="button" onClick={onConfirm} disabled={busy}>
          {confirmLabel ?? "OK"}
        </button>
      </div>
    ) : null,
}

/**
 * "Locked" is not one attribute. A text, rdid, textarea or select field is a
 * native element and carries `disabled`; a checkbox is base-ui's
 * `<span role="checkbox">`, which cannot, and carries `aria-disabled` instead.
 * They are the same fact to the user, and jest-dom's `toBeDisabled` only knows
 * the first — so asking "is this control locked?" goes through here rather than
 * through a per-call-site guess about which kind of element a field renders.
 */
export function expectLocked(element: HTMLElement): void {
  if (element.getAttribute("role") === "checkbox") {
    expect(element).toHaveAttribute("aria-disabled", "true")
  } else {
    expect(element).toBeDisabled()
  }
}

export function expectUnlocked(element: HTMLElement): void {
  if (element.getAttribute("role") === "checkbox") {
    expect(element).not.toHaveAttribute("aria-disabled", "true")
  } else {
    expect(element).toBeEnabled()
  }
}

/**
 * The Save button belonging to THIS container and not to a container inside it.
 * A nested container is a DOM descendant of its parent, so a plain `within()`
 * query on the outer pane matches the row's button too — and an assertion about
 * "the pane's Save" would silently be about whichever came first.
 */
export function saveIn(scope: HTMLElement): HTMLButtonElement {
  const own = within(scope)
    .getAllByRole("button", { name: /^Sav/ })
    .filter((button) => button.closest("[data-editing-container]") === scope)
  const [button] = own
  if (own.length !== 1 || !button) {
    throw new Error(`expected exactly one Save button of this container's own, found ${own.length}`)
  }
  return button as HTMLButtonElement
}

/** A promise plus the handles to settle it, for asserting in-flight states. */
export function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
