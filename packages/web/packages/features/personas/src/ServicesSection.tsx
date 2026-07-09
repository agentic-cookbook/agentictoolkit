"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes } from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import {
  HierarchicalTopicDetail,
  type TopicDetailItem,
  type TopicLevel,
  FieldGroup,
  Field,
  ButtonBar,
  SectionHeader,
} from "@agentic-toolkit/ui/blocks";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import { StackLevels, ToolbarPortal, useRailHost, useRecordAffordance } from "@agentic-toolkit/resource";
import {
  api,
  type UserService,
  type ModelInfo,
  type Template,
  type CreateServiceBody,
  type PatchServiceBody,
} from "@agentic-toolkit/data/personas";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function fmtNum(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ─── ServicesTable ────────────────────────────────────────────────────────────

function StatusBadge({ connectStatus }: { connectStatus: string }) {
  if (connectStatus === "connected") {
    return (
      <span className="rounded bg-apt-green/15 px-1.5 py-0.5 font-mono text-[0.65rem] text-apt-green">
        connected
      </span>
    );
  }
  if (connectStatus === "failed") {
    return (
      <span className="rounded bg-apt-red/15 px-1.5 py-0.5 font-mono text-[0.65rem] text-apt-red">
        failed
      </span>
    );
  }
  return (
    <span className="rounded bg-apt-surface-2 px-1.5 py-0.5 font-mono text-[0.65rem] text-apt-text-muted">
      unknown
    </span>
  );
}

function ServicesTable({
  services,
  onSelect,
}: {
  services: UserService[];
  onSelect: (id: string) => void;
}) {
  if (services.length === 0) {
    return <p className="px-6 pb-4 text-sm text-apt-text-muted">No services yet.</p>;
  }
  return (
    <div className="px-6 pt-2 pb-6">
      <div className="overflow-hidden rounded-xl border border-apt-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-apt-border bg-apt-surface-2/40 text-left font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Provider</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Base URL</th>
              <th className="px-3 py-2 font-medium">Models</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s, i) => (
              <tr
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`cursor-pointer transition-colors hover:bg-apt-surface-2 ${
                  i > 0 ? "border-t border-apt-border" : ""
                }`}
              >
                <td className="px-3 py-2 text-apt-text">{s.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-apt-text-muted">{s.providerKind}</td>
                <td className="px-3 py-2">
                  <StatusBadge connectStatus={s.connectStatus} />
                </td>
                <td className="max-w-[14rem] truncate px-3 py-2 font-mono text-xs text-apt-text-muted">
                  {s.baseUrl}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-apt-text-muted">
                  {s.models.length > 0 ? String(s.models.length) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ModelsTable ──────────────────────────────────────────────────────────────

function CapChip({ label }: { label: string }) {
  return (
    <span className="rounded bg-apt-surface-2 px-1 py-0.5 font-mono text-[0.6rem] text-apt-text-muted">
      {label}
    </span>
  );
}

function ModelsTable({ models }: { models: ModelInfo[] }) {
  if (models.length === 0) {
    return (
      <p className="text-sm text-apt-text-muted">No models yet — Connect or Refresh.</p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-apt-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-apt-border bg-apt-surface-2/40 text-left font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Family</th>
            <th className="px-3 py-2 font-medium">Context</th>
            <th className="px-3 py-2 font-medium">Max out</th>
            <th className="px-3 py-2 font-medium">$/1M in</th>
            <th className="px-3 py-2 font-medium">$/1M out</th>
            <th className="px-3 py-2 font-medium">Caps</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m, i) => (
            <tr key={m.id} className={i > 0 ? "border-t border-apt-border" : ""}>
              <td className="px-3 py-2 text-apt-text">{m.displayName ?? m.id}</td>
              <td className="px-3 py-2 font-mono text-xs text-apt-text-muted">{m.family ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs text-apt-text-muted">
                {fmtNum(m.contextWindow)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-apt-text-muted">
                {fmtNum(m.maxOutputTokens)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-apt-text-muted">
                {m.inputUsdPerMTokens !== undefined ? `$${m.inputUsdPerMTokens.toFixed(2)}` : "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-apt-text-muted">
                {m.outputUsdPerMTokens !== undefined ? `$${m.outputUsdPerMTokens.toFixed(2)}` : "—"}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {m.supportsTools && <CapChip label="tools" />}
                  {m.supportsVision && <CapChip label="vision" />}
                  {m.supportsThinking && <CapChip label="thinking" />}
                  {!m.supportsTools && !m.supportsVision && !m.supportsThinking && (
                    <span className="font-mono text-xs text-apt-text-dim">—</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── ServiceEditor ────────────────────────────────────────────────────────────

type ServiceDraft = {
  templateId: string | undefined;
  name: string;
  providerKind: string;
  baseUrl: string;
  apiKeyInput: string;
};

const BLANK_DRAFT: ServiceDraft = {
  templateId: undefined,
  name: "",
  providerKind: "",
  baseUrl: "",
  apiKeyInput: "",
};

function fromService(s: UserService): ServiceDraft {
  return {
    templateId: s.templateId ?? undefined,
    name: s.name,
    providerKind: s.providerKind,
    baseUrl: s.baseUrl,
    apiKeyInput: "",
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
};

/**
 * The service editor — one shared-component form (grouped Fields + a ButtonBar),
 * for both create (`service === null`) and edit. The caller owns the list; this
 * pane owns the draft, validation, save, delete, connect, and refresh.
 */
function ServiceEditor({
  service,
  onSaved,
  onDeleted,
  onCancel,
}: {
  /** The service to edit, or null to create a new one. */
  service: UserService | null;
  onSaved: (saved: UserService) => void;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const isNew = service === null;
  const renderRecordAffordance = useRecordAffordance();

  // Derive the initial draft from the service prop; keyed remount per id in the
  // parent gives each service a fresh editor, so seeding state here is safe.
  const [draft, setDraft] = useState<ServiceDraft>(() =>
    service ? fromService(service) : BLANK_DRAFT,
  );
  // Live service state: updated after connect/refresh without a full remount.
  const [liveService, setLiveService] = useState<UserService | null>(service);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Load the template catalog on mount — create flow only.
  useEffect(() => {
    if (!isNew) return;
    api
      .templates()
      .then(setTemplates)
      .catch((err) => {
        reportUnexpectedAuthError(err, { feature: "services", step: "templates" });
      });
  }, [isNew]);

  // Apply a template: prefill name, providerKind, baseUrl.
  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) {
      set("templateId", undefined);
      return;
    }
    setDraft((d) => ({
      ...d,
      templateId,
      name: tpl.name,
      providerKind: tpl.providerKind,
      baseUrl: tpl.baseUrl,
    }));
  }

  const valid =
    draft.name.trim() !== "" && draft.providerKind !== "" && draft.baseUrl.trim() !== "";

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    setFormError(null);
    try {
      let saved: UserService;
      if (isNew) {
        const body: CreateServiceBody = {
          name: draft.name.trim(),
          providerKind: draft.providerKind as UserService["providerKind"],
          baseUrl: draft.baseUrl.trim(),
          ...(draft.templateId ? { templateId: draft.templateId } : {}),
          ...(draft.apiKeyInput ? { apiKey: draft.apiKeyInput } : {}),
        };
        saved = await api.services.create(body);
      } else {
        const body: PatchServiceBody = {
          name: draft.name.trim(),
          baseUrl: draft.baseUrl.trim(),
          ...(draft.apiKeyInput ? { apiKey: draft.apiKeyInput } : {}),
        };
        saved = await api.services.patch(service.id, body);
      }
      onSaved(saved);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "services", step: "save" });
      setFormError(err instanceof Error ? err.message : "Failed to save service.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew || !service) return;
    if (!window.confirm(`Delete service "${draft.name}"? This cannot be undone.`)) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.services.delete(service.id);
      onDeleted();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "services", step: "delete" });
      setFormError(err instanceof Error ? err.message : "Failed to delete service.");
      setSaving(false);
    }
  }

  async function handleConnect() {
    if (!service) return;
    setConnecting(true);
    try {
      const updated = await api.services.connect(service.id);
      setLiveService(updated);
      onSaved(updated);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "services", step: "connect" });
    } finally {
      setConnecting(false);
    }
  }

  async function handleRefreshModels() {
    if (!service) return;
    setRefreshing(true);
    try {
      const updated = await api.services.refreshModels(service.id);
      setLiveService(updated);
      onSaved(updated);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "services", step: "refreshModels" });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-6 pt-4 pb-2">
        <SectionHeader title={isNew ? "New service" : draft.name || "Service"} />
        {isNew
          ? renderRecordAffordance?.({
              method: "POST",
              path: "/persona/services",
              pathValues: {},
              title: "Create service API",
            })
          : renderRecordAffordance?.({
              path: "/persona/services/{id}",
              pathValues: { id: service?.id },
              title: "Service API",
            })}
      </div>
      <ToolbarPortal>
        <ButtonBar
          actions={{
            onCreate: () => {},
            onCancel,
            canCancel: true,
            onSave: () => void handleSave(),
            canSave: valid,
            saving,
            onDelete: () => void handleDelete(),
            canDelete: !isNew,
          }}
          showCreate={false}
        />
      </ToolbarPortal>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        {formError && <p className="text-sm text-apt-red">{formError}</p>}

        {/* Template picker — create flow only */}
        {isNew && templates.length > 0 && (
          <FieldGroup title="Start from a template">
            <Field label="Template">
              <Select
                value={draft.templateId ?? ""}
                onChange={(e) => {
                  if (e.target.value) {
                    applyTemplate(e.target.value);
                  } else {
                    setDraft((d) => ({ ...d, templateId: undefined }));
                  }
                }}
              >
                <option value="">Custom (no template)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGroup>
        )}

        <FieldGroup title="Service">
          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="My OpenAI service"
            />
          </Field>
          <Field
            label="Provider"
            hint={!isNew ? "Cannot change after creation." : undefined}
          >
            <Select
              value={draft.providerKind}
              onChange={(e) => set("providerKind", e.target.value)}
              disabled={!isNew}
            >
              <option value="">Select a provider</option>
              {Object.entries(PROVIDER_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Base URL">
            <Input
              value={draft.baseUrl}
              onChange={(e) => set("baseUrl", e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </Field>
          <Field
            label="API key"
            hint={
              !isNew && liveService?.hasApiKey ? "Leave blank to keep the existing key." : undefined
            }
          >
            <Input
              type="password"
              value={draft.apiKeyInput}
              onChange={(e) => set("apiKeyInput", e.target.value)}
              placeholder={!isNew && liveService?.hasApiKey ? "•••• set" : "sk-…"}
            />
          </Field>
        </FieldGroup>

        {/* Edit-only: Connection */}
        {!isNew && liveService && (
          <FieldGroup
            title="Connection"
            trailing={
              liveService.lastConnectedAt ? (
                <span className="font-mono text-[0.65rem] text-apt-text-dim">
                  Last: {fmt(liveService.lastConnectedAt)}
                </span>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => void handleConnect()}
                disabled={connecting}
              >
                {connecting ? "Connecting…" : "Connect"}
              </Button>
              {liveService.connectStatus === "failed" && liveService.connectError && (
                <p className="text-sm text-apt-red">{liveService.connectError}</p>
              )}
              {liveService.connectStatus === "connected" && (
                <p className="text-sm text-apt-green">Connected successfully.</p>
              )}
            </div>
          </FieldGroup>
        )}

        {/* Edit-only: Models */}
        {!isNew && liveService && (
          <FieldGroup
            title="Models"
            trailing={
              liveService.modelsFetchedAt ? (
                <span className="font-mono text-[0.65rem] text-apt-text-dim">
                  Fetched: {fmt(liveService.modelsFetchedAt)}
                </span>
              ) : undefined
            }
          >
            <Button
              size="sm"
              onClick={() => void handleRefreshModels()}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <ModelsTable models={liveService.models} />
          </FieldGroup>
        )}
      </div>
    </div>
  );
}

// ─── ServicesSection ──────────────────────────────────────────────────────────

/**
 * The Services section: a HierarchicalTopicDetail whose rail is the service list
 * and whose pane is the editor (the "All services" table while nothing is open).
 * "New Service" lives in the top bar; the breadcrumb names the open service.
 *
 * DUAL SELECTION MODE (mirrors PersonasSection): pass `urlSelection` and the open service is
 * URL-driven + deep-linkable — a host's persona-services route wires this (see the hub's
 * `ServicesRoute`). Omit it — as an embedded ecosystem topic rail does — and selection is internal
 * state, so opening a service happens IN PLACE without navigating out of the surrounding surface.
 */
export function ServicesSection({
  urlSelection,
}: {
  urlSelection?: {
    /** The open service's id, from the URL path segment (`/<slug>/persona-services/<id>`). */
    serviceId?: string;
    /** Route to a service (null clears back to the list). */
    onSelectService: (id: string | null) => void;
  };
} = {}) {
  const [services, setServices] = useState<UserService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `creating` (a new draft, no id yet) stays LOCAL in both modes — a draft has no URL/id to
  // address, so we never route on create. The OPEN service's id lives in the URL (URL-driven) or
  // internal state (embedded), via useDualModeSelection below.
  const [creating, setCreating] = useState(false);
  // Dual-mode selection: URL-driven (deep-linkable) when `urlSelection` is passed, else internal.
  const { selectedId: openServiceId, select } = useDualModeSelection(
    urlSelection && {
      selectedId: urlSelection.serviceId ?? null,
      onSelect: urlSelection.onSelectService,
    },
  );

  // Open a service (or null to close): URL-driven callers navigate, embedded callers set state.
  const selectService = (id: string | null) => {
    setCreating(false);
    select(id);
  };

  const reload = useCallback(async () => {
    try {
      const ss = await api.services.list();
      setServices(ss);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "services", step: "list" });
      setError(err instanceof Error ? err.message : "Failed to load services.");
      setServices([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = services ?? [];
  const items: TopicDetailItem[] = rows.map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: s.providerKind,
    icon: <Boxes size={16} aria-hidden />,
  }));

  // The open service: the selected id resolved against the loaded rows. An unknown/deleted id (or
  // none) is "nothing open" → the All table (fail-fast, never a blank screen).
  const openService = openServiceId ? rows.find((s) => s.id === openServiceId) ?? null : null;
  const levels: TopicLevel[] = [
    {
      id: "services",
      title: "Persona Services",
      items,
      // While creating a new draft the master list highlights nothing (any previously-open id is
      // still tracked; we don't change selection on create).
      selectedId: creating ? null : openService?.id ?? null,
      onSelect: (id) => selectService(id),
      onClear: () => selectService(null),
      emptyLabel: "No services yet.",
      // "New Service" is a right-justified `+` in the list header; gold while creating. Embedded, we
      // also clear the open service so cancelling the draft returns to the All table (the pre-change
      // behavior); URL-driven, the URL is left put (creating masks it) so Cancel returns to it.
      onNew: () => {
        if (!urlSelection) select(null);
        setCreating(true);
      },
      newLabel: "New Service",
      newActive: creating,
    },
  ];

  // DUAL MODE: under a rail host, PUBLISH the service level into the host's merged stack (its
  // selected row becomes the breadcrumb tail — Acme ▸ Persona Services ▸ Anthropic); standalone, own HTD.
  const railHost = useRailHost();

  const content =
    services === null ? (
      <p className="p-6 text-sm text-apt-text-muted">Loading…</p>
    ) : creating ? (
      // A new draft has no id/URL yet; on save, open the created service.
      <ServiceEditor
        key="__new__"
        service={null}
        onSaved={(saved) => {
          selectService(saved.id);
          void reload();
        }}
        onDeleted={() => {}}
        onCancel={() => setCreating(false)}
      />
    ) : openService ? (
      <ServiceEditor
        key={openService.id}
        service={openService}
        onSaved={(saved) => {
          selectService(saved.id);
          void reload();
        }}
        onDeleted={() => {
          selectService(null);
          void reload();
        }}
        onCancel={() => selectService(null)}
      />
    ) : (
      <>
        {error && <p className="px-6 pt-4 text-sm text-apt-red">{error}</p>}
        <ServicesTable services={rows} onSelect={(id) => selectService(id)} />
      </>
    );

  // Under a rail host: PUBLISH the service level and render the leaf. Standalone: own HTD.
  if (railHost) return <StackLevels levels={levels}>{content}</StackLevels>;
  return (
    <HierarchicalTopicDetail levels={levels} showBreadcrumb={false}>
      {content}
    </HierarchicalTopicDetail>
  );
}
