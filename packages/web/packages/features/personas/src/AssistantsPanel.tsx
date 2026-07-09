"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ErrorText, useAction } from "@agentic-toolkit/crud";
import { Checkbox } from "@agentic-toolkit/ui/components/checkbox";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Button } from "@agentic-toolkit/ui/components/button";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { Field } from "@agentic-toolkit/ui/blocks/field";
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
 * server's returned view on success. A monotonic `loadToken` ref guards the async writes so
 * switching assistants mid-request can never cross one persona's response into another's
 * selection (mirrors AbilitiesPanel). Backend enforces the actual permission (403/400); the
 * panel just surfaces the error.
 */
export function AssistantsPanel() {
  const rowIdPrefix = useId();
  const [personas, setPersonas] = useState<UserActablePersona[] | null>(null);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState("");
  const [tools, setTools] = useState<UserTool[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  // Monotonic load token: every persona switch bumps it so an older in-flight listTools() — or
  // a mutation's optimistic revert/reconcile — that resolves LATER is recognised as stale
  // and dropped rather than written into whichever persona is now selected.
  const loadToken = useRef(0);

  // Load the actable personas once on mount.
  useEffect(() => {
    let live = true;
    personaUserToolsApi
      .listActable()
      .then((rows) => {
        if (live) setPersonas(rows);
      })
      .catch((e) => {
        if (live) setPersonasError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, []);

  const reload = useCallback(async (id: string) => {
    const token = ++loadToken.current;
    if (!id) {
      setTools(null);
      return;
    }
    setTools(null);
    setLoadError(null);
    try {
      const next = await personaUserToolsApi.listTools(id);
      if (loadToken.current !== token) return; // a newer persona was picked — drop this list
      setTools(next);
    } catch (e) {
      if (loadToken.current !== token) return;
      setLoadError(e instanceof Error ? e.message : String(e));
      setTools([]);
    }
  }, []);

  useEffect(() => {
    void reload(personaId);
  }, [personaId, reload]);

  // Replace the whole tool view optimistically, PUT the derived allowed set, reconcile from
  // the server's returned view on success, and restore the prior view on failure. Both the
  // reconcile and the revert are gated by the load token captured at fire time, so a write
  // that resolves AFTER a persona switch never writes into a different persona's selection.
  const applyAllowed = useCallback(
    (prev: UserTool[], optimistic: UserTool[]) => {
      const token = loadToken.current;
      const id = personaId;
      setTools(optimistic);
      void run(async () => {
        try {
          const reconciled = await personaUserToolsApi.setAllowed(id, allowedNames(optimistic));
          if (loadToken.current === token) setTools(reconciled);
        } catch (e) {
          if (loadToken.current === token) setTools(prev);
          throw e;
        }
      });
    },
    [personaId, run],
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

        {personas === null ? (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        ) : personasError !== null ? (
          <ErrorText error={personasError} />
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
              <p className="text-sm text-apt-text-muted">Loading…</p>
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
                            <ListItem key={tool.toolName}>
                              <Checkbox
                                id={rowId}
                                checked={tool.allowed}
                                disabled={busy}
                                onCheckedChange={(checked) => toggleTool(tool, checked)}
                              />
                              <label
                                htmlFor={rowId}
                                className="min-w-0 flex-1 font-mono text-sm text-apt-text"
                              >
                                {tool.toolName}
                              </label>
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
