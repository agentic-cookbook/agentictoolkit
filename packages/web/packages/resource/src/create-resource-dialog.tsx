"use client";

import {
  CreateResourceDialog as UiCreateResourceDialog,
  type CreateResourceDialogProps,
} from "@agentic-toolkit/ui/blocks";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";

/**
 * The shared "New …" modal (see the ui block for the full contract, incl. the
 * optional `saveEnabled` Save gate). The component itself moved DOWN to
 * `@agentic-toolkit/ui/blocks` so consumers that vendor only ui (the
 * self-enclosed status/builds backends) can obey the HTD recipe's
 * `must-create-in-modal` without pulling this whole package; this re-export
 * keeps the resource-feature API identical by pre-wiring the auth telemetry
 * seam (ui can't import auth — auth depends on ui).
 */
export function CreateResourceDialog<TInput, TResult>(
  props: Omit<CreateResourceDialogProps<TInput, TResult>, "onSaveError">,
) {
  return (
    <UiCreateResourceDialog
      {...props}
      onSaveError={(err) =>
        reportUnexpectedAuthError(err, { feature: "create-resource-dialog", step: "save" })
      }
    />
  );
}
