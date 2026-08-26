"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useAction } from "@agentic-toolkit/crud";
import { useResourceList } from "@agentic-toolkit/data";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { Checkbox } from "@agenticdevelopertoolkit/ui/components/checkbox";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { List, ListItem } from "@agenticdevelopertoolkit/ui/components/list";
import { Field } from "@agenticdevelopertoolkit/ui/blocks/field";
import {
  personaUserToolsApi,
  type UserActablePersona,
  type UserTool,
} from "@agentic-toolkit/data/personas";
import { groupBySource } from "./agent-tool-source";

/** The names of the tools currently allowed, in catalog order (the PUT payload shape). */
function allowedNames(tools: UserTool[]): string[] {
  return tools.filter((t) => t.allowed).map((t) => t.toolName);
}

/**
 * User Settings "Assistants" panel (Layer-2 per-user consent). For each persona an owner has
 * let act FOR the caller (`may_act 'user'`), the caller picks it and toggles — per tool —
 * whether it may invoke that tool on their behalf, with an all-on / all-off pair. Default
 * off: an untoggled tool is not allowed.
 *
 * Every change replaces the caller's whole allowed set (`PUT user-tools`) OPTIMISTICALLY —
 * the checklist flips instantly and reverts if the request rejects, reconciling from the
 * server's returned view on success. Backend enforces the actual permission (403/400); the
 * panel just surfaces the error.
 *
 * Both reads are CACHED, and each assistant's tool list under its own key — so flipping back to
 * an assistant you looked at a moment ago shows its checklist immediately rather than a spinner.
 */
export function AssistantsPanel() {
  const rowIdPrefix = useId();
  const [personaId, setPersonaId] = useState("");
  const { busy, error, run } = useAction();

  // The assistants that may act for the caller. Caller-scoped, so one entry serves every mount.
  const { items: personas, error: personasError } = useResourceList<UserActablePersona>(
    "personas:actable-for-me",
    personaUserToolsApi.listActable,
  );

  // The selected assistant's tools, keyed BY assistant. That key is what replaces the monotonic
  // load token this panel used to carry: a response can only ever land on the entry it was read
  // for, so an older in-flight `listTools()` cannot write into whichever assistant is now picked.
  // No selection reads nothing.
  const loadTools = useCallback(
    () => (personaId ? personaUserToolsApi.listTools(personaId) : Promise.resolve([] as UserTool[])),
    [personaId],
  );
  const {
    items: tools,
    error: loadError,
    setItems: setTools,
  } = useResourceList<UserTool>(`persona:${personaId}:user-tools`, loadTools);

  // Replace the whole tool view optimistically, PUT the derived allowed set, reconcile from
  // the server's returned view on success, and restore the prior view on failure.
  //
  // The token guard is gone for the same reason: `setTools` is bound to the cache key of the
  // render that produced it, so a reconcile or a revert that resolves after a switch writes into
  // the assistant it was ABOUT — which is both correct for that assistant and invisible to the
  // one now on screen.
  const applyAllowed = useCallback(
    (prev: UserTool[], optimistic: UserTool[]) => {
      const id = personaId;
      setTools(optimistic);
      void run(async () => {
        try {
          setTools(await personaUserToolsApi.setAllowed(id, allowedNames(optimistic)));
        } catch (e) {
          setTools(prev);
          throw e;
        }
      });
    },
    [personaId, run, setTools],
  );

  function toggleTool(tool: UserTool, allowed: boolean) {
    if (!tools) return;
    applyAllowed(
      tools,
      tools.map((t) => (t.toolName === tool.toolName ? { ...t, allowed } : t)),
    );
  }

  function setAll(allowed: boolean) {
    if (!tools) return;
    applyAllowed(tools, tools.map((t) => ({ ...t, allowed })));
  }

  // Group by source so built-ins and each external source read as their own section.
  const groups = useMemo(() => groupBySource(tools ?? [], (t) => t.source), [tools]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="flex max-w-2xl flex-col gap-4">
        <p className="text-sm text-apt-text-muted">
          Control what each assistant may do on your behalf. Every tool is off until you allow
          it here.
        </p>

        {/* The FAILURE is read first: a failed read leaves the rows null, so testing for null
            first would leave the panel saying "Loading…" over a read that has already given up. */}
        {personasError !== null ? (
          <ErrorText error={personasError} />
        ) : personas === null ? (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        ) : personas.length === 0 ? (
          <p className="text-sm text-apt-text-muted">
            No assistants can act for you yet. When an assistant is granted leave to act on your
            behalf, it will appear here.
          </p>
        ) : (
          <>
            <Field label="Assistant">
              <Select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                <option value="">Choose an assistant…</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </Select>
            </Field>

            <ErrorText error={loadError ?? error} />

            {personaId === "" ? (
              <p className="text-sm text-apt-text-muted">
                Pick an assistant to review what it may do for you.
              </p>
            ) : tools === null ? (
              // A failed read leaves the rows null too, and the banner above already says why —
              // so this must not go on claiming the list is still on its way.
              loadError ? null : (
                <p className="text-sm text-apt-text-muted">Loading…</p>
              )
            ) : tools.length === 0 ? (
              <p className="text-sm text-apt-text-muted">
                This assistant has no tools you can allow.
              </p>
            ) : (
              <>
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-label="Allow all or none"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setAll(true)}
                  >
                    All on
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setAll(false)}
                  >
                    All off
                  </Button>
                </div>

                <div className="flex flex-col gap-4">
                  {groups.map(([label, rows]) => (
                    <div key={label} className="flex flex-col gap-2">
                      <h4 className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
                        {label}
                      </h4>
                      <List>
                        {rows.map((tool) => {
                          const rowId = `${rowIdPrefix}-${tool.toolName}`;
                          return (
                            <ListItem key={tool.toolName} className="items-start">
                              <Checkbox
                                id={rowId}
                                checked={tool.allowed}
                                disabled={busy}
                                onCheckedChange={(checked) => toggleTool(tool, checked)}
                                aria-label={`allow ${tool.displayName || tool.toolName}`}
                              />
                              {/* Human-readable label leads (the checkbox's accessible name); the
                                  description + raw mono tool name are demoted siblings OUTSIDE the
                                  label. displayName falls back to toolName for an uncataloged tool. */}
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <label htmlFor={rowId} className="text-sm text-apt-text">
                                  {tool.displayName || tool.toolName}
                                </label>
                                {tool.description && (
                                  <span className="text-[0.75rem] text-apt-text-muted">
                                    {tool.description}
                                  </span>
                                )}
                                <span
                                  className="font-mono text-[0.7rem] text-apt-text-dim"
                                  title={tool.toolName}
                                >
                                  {tool.toolName}
                                </span>
                              </div>
                            </ListItem>
                          );
                        })}
                      </List>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
