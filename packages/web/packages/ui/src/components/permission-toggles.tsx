"use client";

import { cn } from "../lib/utils";
import { CRUD_KEYS, CRUD_LETTER, type Crud, type CrudKey } from "./crud";

/**
 * Four C/R/U/D toggle chips. A capability the `parent` disallows is rendered
 * disabled and forced visually off — the single UI affordance for "cannot be
 * more permissive than parent". `onChange` always emits a value already clamped
 * to the parent, so callers never receive an invalid Crud.
 */
export function PermissionToggles({
  value,
  parent,
  disabled = false,
  onChange,
}: {
  value: Crud;
  /** Ceiling. Omit for the root (e.g. a whole-schema/bucket grant), which has no parent. */
  parent?: Crud;
  disabled?: boolean;
  onChange: (next: Crud) => void;
}) {
  function toggle(key: CrudKey) {
    if (disabled) return;
    if (parent && !parent[key]) return; // parent forbids — no-op
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="CRUD permissions">
      {CRUD_KEYS.map((key) => {
        const blockedByParent = parent ? !parent[key] : false;
        const on = value[key] && !blockedByParent;
        const isDisabled = disabled || blockedByParent;
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            disabled={isDisabled}
            aria-pressed={on}
            title={
              blockedByParent
                ? `${key} is not permitted by the parent`
                : `${on ? "Disable" : "Enable"} ${key}`
            }
            className={cn(
              "flex size-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
              on
                ? "border-apt-gold bg-apt-gold/20 text-apt-gold-bright"
                : "border-apt-border bg-apt-bg text-apt-text-muted hover:text-apt-text",
              isDisabled && "cursor-not-allowed opacity-40 hover:text-apt-text-muted",
            )}
          >
            {CRUD_LETTER[key]}
          </button>
        );
      })}
    </div>
  );
}
