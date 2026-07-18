"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes } from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import {
  HierarchicalDetailView,
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
import {
  StackLevels,
  ToolbarPortal,
  useRailHost,
  useRecordAffordance,
  CreateResourceDialog,
} from "@agentic-toolkit/resource";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { fmtDate } from "./format";
import {
  api,
  type UserService,
  type ModelInfo,
  type Template,
  type PatchServiceBody,
} from "@agentic-toolkit/data/personas";

// ─── helpers ──────────────────────────────────────────────────────────────────

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
 * The service's editable fields (name, provider, base URL, API key) — one shared FieldGroup used by
 * BOTH the "New service" create modal and the edit editor, so the field set lives in one place
 * (DRY). The provider is fixed after creation, so the edit editor passes `providerDisabled`; the
 * API-key hint/placeholder differ between create and edit (an existing key is masked, not shown).
 */
function ServiceFields({
  draft,
  onChange,
  providerDisabled,
  apiKeyHint,
  apiKeyPlaceholder,
  autoFocusName,
}: {
  draft: ServiceDraft;
  onChange: (next: ServiceDraft) => void;
  /** Provider can't change after creation, so the edit form disables it. */
  providerDisabled?: boolean;
  apiKeyHint?: string;
  apiKeyPlaceholder?: string;
  /** Focus the Name field on mount (the create modal opens straight into it). */
  autoFocusName?: boolean;
}) {
  return (
    <FieldGroup title="Service">
      <Field label="Name">
        <Input
          /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field when the modal opens */
          autoFocus={autoFocusName}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="My OpenAI service"
        />
      </Field>
      <Field label="Provider" hint={providerDisabled ? "Cannot change after creation." : undefined}>
        <Select
          value={draft.providerKind}
          onChange={(e) => onChange({ ...draft, providerKind: e.target.value })}
          disabled={providerDisabled}
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
          onChange={(e) => onChange({ ...draft, baseUrl: e.target.value })}
          placeholder="https://api.openai.com/v1"
        />
      </Field>
      <Field label="API key" hint={apiKeyHint}>
        <Input
          type="password"
          value={draft.apiKeyInput}
          onChange={(e) => onChange({ ...draft, apiKeyInput: e.target.value })}
          placeholder={apiKeyPlaceholder ?? "sk-…"}
        />
      </Field>
    </FieldGroup>
  );
}

/** Returns an error message, or null when the create draft is valid. */
function validateServiceDraft(d: ServiceDraft): string | null {
  if (d.name.trim() === "") return "A name is required.";
  if (d.providerKind === "") return "Select a provider.";
  if (d.baseUrl.trim() === "") return "A base URL is required.";
  return null;
}

/** The "New service" modal's form: an optional template picker (which prefills the fields) above the
 *  shared {@link ServiceFields}. A component (not inline JSX) so its template-catalog fetch hook is
 *  stable across the dialog's renders. */
function NewServiceForm({
  draft,
  onChange,
  error,
}: {
  draft: ServiceDraft;
  onChange: (next: ServiceDraft) => void;
  error: string | null;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  useEffect(() => {
    api
      .templates()
      .then(setTemplates)
      .catch((err) => {
        reportUnexpectedAuthError(err, { feature: "services", step: "templates" });
      });
  }, []);

  // Apply a template: prefill name, providerKind, baseUrl.
  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) {
      onChange({ ...draft, templateId: undefined });
      return;
    }
    onChange({
      ...draft,
      templateId,
      name: tpl.name,
      providerKind: tpl.providerKind,
      baseUrl: tpl.baseUrl,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {templates.length > 0 && (
        <FieldGroup title="Start from a template">
          <Field label="Template">
            <Select
              value={draft.templateId ?? ""}
              onChange={(e) => {
                if (e.target.value) applyTemplate(e.target.value);
                else onChange({ ...draft, templateId: undefined });
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
      <ServiceFields draft={draft} onChange={onChange} autoFocusName />
      {error && <ErrorText error={error} />}
    </div>
  );
}

/**
 * The service editor — the shared {@link ServiceFields} plus a Connection + Models section and a
 * ButtonBar, for EDITING an existing service. Creating is a modal now (see the CreateResourceDialog
 * in ServicesSection), so this always has a real service. The caller owns the list; this pane owns
 * the draft, validation, save, delete, connect, and refresh.
 */
function ServiceEditor({
  service,
  onSaved,
  onDeleted,
  onCancel,
}: {
  /** The service to edit (never null — create is a modal). */
  service: UserService;
  onSaved: (saved: UserService) => void;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const renderRecordAffordance = useRecordAffordance();

  // Derive the initial draft from the service prop; keyed remount per id in the
  // parent gives each service a fresh editor, so seeding state here is safe.
  const [draft, setDraft] = useState<ServiceDraft>(() => fromService(service));
  // Live service state: updated after connect/refresh without a full remount.
  const [liveService, setLiveService] = useState<UserService>(service);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const valid =
    draft.name.trim() !== "" && draft.providerKind !== "" && draft.baseUrl.trim() !== "";

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    setFormError(null);
    try {
      const body: PatchServiceBody = {
        name: draft.name.trim(),
        baseUrl: draft.baseUrl.trim(),
        ...(draft.apiKeyInput ? { apiKey: draft.apiKeyInput } : {}),
      };
      const saved = await api.services.patch(service.id, body);
      onSaved(saved);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "services", step: "save" });
      setFormError(err instanceof Error ? err.message : "Failed to save service.");
      setSaving(false);
    }
  }

  async function handleDelete() {
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
        <SectionHeader title={draft.name || "Service"} />
        {renderRecordAffordance?.({
          path: "/persona/services/{id}",
          pathValues: { id: service.id },
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
            canDelete: true,
          }}
          showCreate={false}
        />
      </ToolbarPortal>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <ErrorText error={formError} />

        <ServiceFields
          draft={draft}
          onChange={setDraft}
          providerDisabled
          apiKeyHint={liveService.hasApiKey ? "Leave blank to keep the existing key." : undefined}
          apiKeyPlaceholder={liveService.hasApiKey ? "•••• set" : "sk-…"}
        />

        <FieldGroup
          title="Connection"
          trailing={
            liveService.lastConnectedAt ? (
              <span className="font-mono text-[0.65rem] text-apt-text-dim">
                Last: {fmtDate(liveService.lastConnectedAt)}
              </span>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={() => void handleConnect()} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect"}
            </Button>
            {liveService.connectStatus === "failed" && liveService.connectError && (
              <ErrorText error={liveService.connectError} />
            )}
            {liveService.connectStatus === "connected" && (
              <p className="text-sm text-apt-green">Connected successfully.</p>
            )}
          </div>
        </FieldGroup>

        <FieldGroup
          title="Models"
          trailing={
            liveService.modelsFetchedAt ? (
              <span className="font-mono text-[0.65rem] text-apt-text-dim">
                Fetched: {fmtDate(liveService.modelsFetchedAt)}
              </span>
            ) : undefined
          }
        >
          <Button size="sm" onClick={() => void handleRefreshModels()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <ModelsTable models={liveService.models} />
        </FieldGroup>
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
  title = "Persona Services",
}: {
  /** The rail level's heading — the label this list appears under in the stack (e.g.
   *  "LLM Providers" when hosted as a workspace Settings topic). Defaults to the feature's
   *  own name so standalone/embedded callers are unchanged. */
  title?: string;
  urlSelection?: {
    /** The open service's id, from the URL path segment (`/<slug>/persona-services/<id>`). */
    serviceId?: string;
    /** Route to a service (null clears back to the list). */
    onSelectService: (id: string | null) => void;
  };
} = {}) {
  const [services, setServices] = useState<UserService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Creating a service is a MODAL over the stack, never a blank editor leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens it, and on save the created service is selected so its
  // editor (Connection, Models) opens.
  const [newOpen, setNewOpen] = useState(false);
  // Dual-mode selection: URL-driven (deep-linkable) when `urlSelection` is passed, else internal.
  const { selectedId: openServiceId, select } = useDualModeSelection(
    urlSelection && {
      selectedId: urlSelection.serviceId ?? null,
      onSelect: urlSelection.onSelectService,
    },
  );

  // Open a service (or null to close): URL-driven callers navigate, embedded callers set state.
  const selectService = (id: string | null) => {
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
      title,
      items,
      selectedId: openService?.id ?? null,
      onSelect: (id) => selectService(id),
      onClear: () => selectService(null),
      emptyLabel: "No services yet.",
      // "New Service" is a right-justified `+` in the list header; it opens the create modal.
      onNew: () => setNewOpen(true),
      newLabel: "New Service",
      // This level's unselected state is a REAL landing (the All table below), never the automatic
      // TopicOverview grid (mirrors PersonasSection).
      overview: false,
    },
  ];

  // DUAL MODE: under a rail host, PUBLISH the service level into the host's merged stack (its
  // selected row becomes the breadcrumb tail — Acme ▸ Persona Services ▸ Anthropic); standalone, own HTD.
  const railHost = useRailHost();

  const content =
    services === null ? (
      <p className="p-6 text-sm text-apt-text-muted">Loading…</p>
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
        <ErrorText error={error} className="px-6 pt-4" />
        <ServicesTable services={rows} onSelect={(id) => selectService(id)} />
      </>
    );

  // Create is a scoped modal: an optional template picker + the service's fields (HTD recipe
  // `must-create-in-modal`). Connecting and refreshing models live in the service's editor, which
  // opens once the created service is selected.
  const newDialog = newOpen ? (
    <CreateResourceDialog<ServiceDraft, UserService>
      ariaLabel="New service"
      heading="New service"
      blank={() => ({ ...BLANK_DRAFT })}
      validate={validateServiceDraft}
      create={(d) =>
        api.services.create({
          name: d.name.trim(),
          providerKind: d.providerKind as UserService["providerKind"],
          baseUrl: d.baseUrl.trim(),
          ...(d.templateId ? { templateId: d.templateId } : {}),
          ...(d.apiKeyInput ? { apiKey: d.apiKeyInput } : {}),
        })
      }
      onClose={() => setNewOpen(false)}
      onCreated={(saved) => {
        setNewOpen(false);
        selectService(saved.id);
        void reload();
      }}
      renderForm={(draft, onChange, error) => (
        <NewServiceForm draft={draft} onChange={onChange} error={error} />
      )}
    />
  ) : null;

  // Under a rail host: PUBLISH the service level and render the leaf. Standalone: own stack.
  if (railHost)
    return (
      <>
        <StackLevels levels={levels}>{content}</StackLevels>
        {newDialog}
      </>
    );
  return (
    <>
      <HierarchicalDetailView levels={levels} showBreadcrumb={false}>
        {content}
      </HierarchicalDetailView>
      {newDialog}
    </>
  );
}
