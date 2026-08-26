"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PrivacyLevelSelect } from "@agenticdevelopertoolkit/ui/components/privacy-level-select";

import {
  setPrivacyGrant,
  PRIVACY_KEY,
  type PrivacyLevel,
  type PrivacyTargetTable,
} from "@agentic-toolkit/data/profile";

/**
 * One profile row's audience control, with its grant mutation.
 *
 * The mutation lives HERE, not in the parent section, because a privacy grant only exists for
 * a PERSONAL row: PUT /account/privacy stamps the grant with the caller as the profile owner
 * and 404s a target the caller doesn't personally own, so an ORG-owned row has no grant to
 * write. A section rendering org rows simply doesn't render this component — and since hooks
 * can't be constructed conditionally, keeping the mutation out of the parent is the only way
 * the org path can avoid holding a writer it must never call.
 */
export interface PrivacyLevelControlProps {
  targetTable: PrivacyTargetTable;
  targetId: string;
  level: PrivacyLevel;
  ariaLabel: string;
}

export function PrivacyLevelControl({
  targetTable,
  targetId,
  level,
  ariaLabel,
}: PrivacyLevelControlProps) {
  const qc = useQueryClient();

  const privacyMutation = useMutation({
    mutationFn: (next: PrivacyLevel) => setPrivacyGrant(targetTable, targetId, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRIVACY_KEY });
    },
  });

  return (
    <div className="w-36">
      <PrivacyLevelSelect
        value={level}
        onChange={(next) => privacyMutation.mutate(next)}
        ariaLabel={ariaLabel}
        disabled={privacyMutation.isPending}
      />
    </div>
  );
}
