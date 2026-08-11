"use client"

import * as React from "react"

import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal"
import { UnsavedChangesGuard } from "@agentic-toolkit/ui/components/unsaved-changes-guard"

/**
 * THE HOST — the two pieces of the platform an editing container reaches out to,
 * injected rather than imported at the point of use.
 *
 * Both are real, shared components in `@agentic-toolkit/ui`, and the default host
 * is exactly those. The indirection buys two things:
 *
 * - The container's contract with the navigation guard ("publish `when`, once, from
 *   the root") becomes observable in a unit test: a fake host records what it was
 *   handed, so "does a dirty container arm the guard?" is an assertion rather than
 *   an integration hope. Given that getting this wrong loses a user's work, it has
 *   to be provable at this level.
 * - A Next app supplies its router so a blocked in-app link navigates client-side
 *   ({@link createEditingHost}), instead of every container taking a dependency on
 *   the app's router.
 */

export interface EditingAlertProps {
  readonly open: boolean
  readonly title: string
  readonly description?: React.ReactNode
  readonly tone: "info" | "success" | "error"
  readonly confirmLabel?: string
  /** A write is in flight: no button, no dismiss. The repair prompt uses it so the
   *  user cannot acknowledge twice while the repairing save is still running. */
  readonly busy?: boolean
  /**
   * Whether Escape / backdrop / ✕ may close the alert. Default true.
   *
   * The repair PROMPT sets it false, because its confirm writes to the server:
   * a one-button alert routes every dismissal gesture to `onConfirm`, so
   * pressing Escape to make the dialog go away would save. The two
   * acknowledgements that follow it stay dismissible — they do nothing.
   */
  readonly dismissible?: boolean
  readonly onConfirm: () => void
}

export interface EditingHost {
  /** Rendered by the ROOT container only, with the aggregate dirty state. */
  readonly UnsavedChangesGuard: React.ComponentType<{ when: boolean }>
  /** The single-button acknowledgement used by the repair flow. */
  readonly Alert: React.ComponentType<EditingAlertProps>
}

function PlatformAlert({
  open,
  title,
  description,
  tone,
  confirmLabel,
  busy,
  dismissible,
  onConfirm,
}: EditingAlertProps): React.ReactElement {
  return (
    <AlertModal
      open={open}
      title={title}
      description={description}
      tone={tone}
      confirmLabel={confirmLabel ?? "OK"}
      busy={busy}
      dismissible={dismissible}
      onConfirm={onConfirm}
    />
  )
}

/**
 * The host used when no provider is mounted: the platform's own guard and alert,
 * with a full-page navigation on discard. Correct everywhere; a Next app should
 * still wrap once with {@link createEditingHost} so a discarded edit keeps the
 * client-side route transition.
 */
export const defaultEditingHost: EditingHost = {
  UnsavedChangesGuard: ({ when }) => <UnsavedChangesGuard when={when} />,
  Alert: PlatformAlert,
}

/** The platform host, wired to an app router's push. */
export function createEditingHost(options: {
  onNavigate: (href: string) => void
}): EditingHost {
  const { onNavigate } = options
  return {
    UnsavedChangesGuard: ({ when }) => <UnsavedChangesGuard when={when} onNavigate={onNavigate} />,
    Alert: PlatformAlert,
  }
}

const EditingHostContext = React.createContext<EditingHost>(defaultEditingHost)

export function EditingHostProvider({
  host,
  children,
}: {
  host: EditingHost
  children: React.ReactNode
}): React.ReactElement {
  return <EditingHostContext.Provider value={host}>{children}</EditingHostContext.Provider>
}

export function useEditingHost(): EditingHost {
  return React.useContext(EditingHostContext)
}
