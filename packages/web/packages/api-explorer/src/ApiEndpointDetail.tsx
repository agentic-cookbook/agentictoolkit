'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Loader2, Send } from 'lucide-react'
import { cn } from '@agentic-toolkit/ui'
import { useAuth } from '@agentic-toolkit/auth'
import { Button } from '@agentic-toolkit/ui/components/button'
import { Input } from '@agentic-toolkit/ui/components/input'
import { Select } from '@agentic-toolkit/ui/components/select'
import { Textarea } from '@agentic-toolkit/ui/components/textarea'
import { Field, FieldGroup } from '@agentic-toolkit/ui/blocks'
import { Tabs, TabsList, TabsTab, TabsPanel } from '@agentic-toolkit/ui/components/tabs'
import { Disclosure } from '@agentic-toolkit/ui/components/disclosure'
import { AlertModal } from '@agentic-toolkit/ui/components/alert-modal'
import { CodeBlock } from './CodeBlock'
import {
  bodyAllowed,
  buildRequest,
  executeRequest,
  isMutating,
  substitutePath,
  type ApiResult,
} from './lib/buildRequest'
import { describeFields, schemaToExample } from './lib/schema'
import { prettyJson } from './lib/highlight'
import { methodBadgeClass, statusTone } from './lib/tone'
import { PUBLIC_API_ORIGIN, SNIPPET_LANGS, snippetFor } from './lib/snippets'
import type { EndpointMeta, EndpointParam, EndpointResponse } from './types'

export interface ApiEndpointDetailProps {
  meta: EndpointMeta
  /** Seed values for path/query params (matched by name), e.g. the id being configured. */
  initialPathValues?: Record<string, string>
  initialQueryValues?: Record<string, string>
  /** Seed request-body JSON (else the schema example). */
  initialBody?: string
  apiOrigin?: string
  /** Browse-only: drop the interactive "Try it" panel (its param inputs, Send, and result), so
   *  the pane is a pure reference — Overview + Response schema + Code examples. Set on the PUBLIC
   *  API-reference site, which has no session. When falsy (every authenticated consumer — hub,
   *  admin, community, the Help modal) the try-it panel renders exactly as before. Because the
   *  try-it panel owns the only `useAuth()` call, a `readOnly` pane needs no AuthProvider at all. */
  readOnly?: boolean
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold uppercase',
        methodBadgeClass(method),
      )}
    >
      {method}
    </span>
  )
}

/** A non-collapsible section framed like {@link Disclosure} (so the static Overview
 *  lines up with the disclosable sections) — chevron space reserved, no toggle. */
function StaticSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-apt-border bg-apt-bg">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="size-4 shrink-0" aria-hidden />
        <span className="text-sm font-medium text-apt-text">{title}</span>
      </div>
      <div className="flex flex-col gap-3 border-t border-apt-border px-3 py-3">{children}</div>
    </div>
  )
}

function ParamInput({
  param,
  value,
  onChange,
}: {
  param: EndpointParam
  value: string
  onChange: (value: string) => void
}) {
  const schema = param.schema
  const enumValues =
    typeof schema === 'object' && schema !== null && Array.isArray((schema as Record<string, unknown>)['enum'])
      ? ((schema as Record<string, unknown>)['enum'] as unknown[]).map(String)
      : null

  if (enumValues) {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {!param.required && <option value="">(none)</option>}
        {enumValues.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>
    )
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={param.required ? 'required' : 'optional'}
      className="font-mono"
    />
  )
}

function SchemaFieldList({ schema }: { schema: EndpointResponse['schema'] }) {
  const fields = useMemo(() => describeFields(schema), [schema])
  if (fields.length === 0) return null
  return (
    <ul className="divide-y divide-apt-border/60 rounded-lg border border-apt-border">
      {fields.map((field) => (
        <li key={field.name} className="flex flex-col gap-0.5 px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm text-apt-text">{field.name}</span>
            {!field.required && <span className="text-xs text-apt-text-dim">optional</span>}
            <span className="ml-auto font-mono text-xs text-apt-text-muted">{field.type}</span>
          </div>
          {field.description && <p className="text-xs text-apt-text-muted">{field.description}</p>}
        </li>
      ))}
    </ul>
  )
}

function seedValues(params: EndpointParam[], loc: 'path' | 'query', src?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of params) {
    if (p.in !== loc) continue
    const v = src?.[p.name]
    if (v != null) out[p.name] = v
  }
  return out
}

/**
 * The full detail for ONE endpoint — one pane with disclosable sections: Overview
 * (static), Response and Code examples (collapsed by default), and — unless
 * {@link ApiEndpointDetailProps.readOnly | readOnly} — the interactive Try it panel
 * (open by default). The browser remounts this (keyed by endpoint) when you navigate,
 * so state never leaks between endpoints and the disclosures reset on each endpoint.
 *
 * Path/query/body values live here (not in the try-it panel) because the Code examples
 * render them too; the try-it panel edits them through the setters passed down.
 */
export function ApiEndpointDetail({
  meta,
  initialPathValues,
  initialQueryValues,
  initialBody,
  apiOrigin = PUBLIC_API_ORIGIN,
  readOnly = false,
}: ApiEndpointDetailProps) {
  const [pathValues, setPathValues] = useState<Record<string, string>>(() => seedValues(meta.params, 'path', initialPathValues))
  const [queryValues, setQueryValues] = useState<Record<string, string>>(() => seedValues(meta.params, 'query', initialQueryValues))
  const [bodyText, setBodyText] = useState<string>(() =>
    initialBody != null
      ? initialBody
      : meta.requestBody
        ? JSON.stringify(schemaToExample(meta.requestBody.schema), null, 2)
        : '',
  )
  const [activeStatus, setActiveStatus] = useState<string>(() => meta.responses[0]?.status ?? '')

  const values = { pathValues, queryValues, body: bodyText }

  return (
    <div className="flex flex-col gap-4">
      {/* Overview — not disclosable */}
      <StaticSection title="Overview">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-apt-border bg-apt-surface-2 px-3 py-2">
          <MethodBadge method={meta.method} />
          <code className="break-all font-mono text-sm text-apt-text">{meta.path}</code>
          {meta.tag && (
            <span className="rounded-md border border-apt-border bg-apt-surface px-2 py-0.5 text-xs text-apt-text-muted">
              {meta.tag}
            </span>
          )}
        </div>
        {meta.summary && <h3 className="text-base font-semibold leading-snug text-apt-text">{meta.summary}</h3>}
        {meta.description && <p className="whitespace-pre-line text-sm text-apt-text-muted">{meta.description}</p>}
        {meta.security && meta.security.length > 0 && (
          <p className="text-xs text-apt-text-dim">
            Auth: <span className="font-mono">{meta.security.join(', ')}</span> — calls run as the logged-in user.
          </p>
        )}
      </StaticSection>

      {/* Response — disclosable, collapsed by default */}
      {meta.responses.length > 0 && (
        <Disclosure title="Response" className="bg-apt-bg">
          <Tabs value={activeStatus} onValueChange={(v) => setActiveStatus(String(v))}>
            <TabsList>
              {meta.responses.map((r) => (
                <TabsTab key={r.status} value={r.status}>
                  <span className={statusTone(r.status)}>{r.status}</span>
                </TabsTab>
              ))}
            </TabsList>
            {meta.responses.map((r) => (
              <TabsPanel key={r.status} value={r.status} className="flex flex-col gap-3 pt-3">
                {r.description && <p className="text-sm text-apt-text-muted">{r.description}</p>}
                {r.schema ? (
                  <>
                    <SchemaFieldList schema={r.schema} />
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-xs uppercase tracking-wider text-apt-text-muted">Example</span>
                      <CodeBlock code={JSON.stringify(schemaToExample(r.schema), null, 2)} lang="json" ariaLabel={`Example ${r.status} body`} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-apt-text-dim">No response body.</p>
                )}
              </TabsPanel>
            ))}
          </Tabs>
        </Disclosure>
      )}

      {/* Code examples — disclosable, collapsed by default */}
      <Disclosure title="Code examples" className="bg-apt-bg">
        <div className="flex flex-col gap-4">
          {SNIPPET_LANGS.map((l) => (
            <div key={l.id} className="flex flex-col gap-1.5">
              <span className="font-mono text-xs uppercase tracking-wider text-apt-text-muted">{l.label}</span>
              <CodeBlock code={snippetFor(l.id, meta, values, apiOrigin)} lang={l.highlight} ariaLabel={`${l.label} snippet`} />
            </div>
          ))}
        </div>
      </Disclosure>

      {/* Try it — disclosable, open by default. Omitted on read-only (public) surfaces; it owns
          the sole useAuth() call, so a read-only pane needs no AuthProvider. */}
      {!readOnly && (
        <TryItPanel
          meta={meta}
          pathValues={pathValues}
          setPathValues={setPathValues}
          queryValues={queryValues}
          setQueryValues={setQueryValues}
          bodyText={bodyText}
          setBodyText={setBodyText}
          onResponseStatus={(status) => {
            if (meta.responses.some((r) => r.status === status)) setActiveStatus(status)
          }}
        />
      )}
    </div>
  )
}

/**
 * The interactive "Try it" panel: param/body inputs, a Send that runs the request as the
 * logged-in user (through the site's same-origin `/api` BFF proxy), and the live result. Split
 * out of {@link ApiEndpointDetail} so that it — and its `useAuth()` dependency — mount ONLY on
 * authenticated surfaces; a read-only pane omits it entirely and needs no AuthProvider.
 *
 * The path/query/body VALUES are owned by the parent (the Code examples render them too) and
 * edited here via the setters; the send-lifecycle state (result, in-flight, confirm) is local.
 */
function TryItPanel({
  meta,
  pathValues,
  setPathValues,
  queryValues,
  setQueryValues,
  bodyText,
  setBodyText,
  onResponseStatus,
}: {
  meta: EndpointMeta
  pathValues: Record<string, string>
  setPathValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  queryValues: Record<string, string>
  setQueryValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  bodyText: string
  setBodyText: (value: string) => void
  onResponseStatus: (status: string) => void
}) {
  const { isAuthenticated, accessToken } = useAuth()

  const [result, setResult] = useState<ApiResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const values = { pathValues, queryValues, body: bodyText }
  const pathParams = meta.params.filter((p) => p.in === 'path')
  const queryParams = meta.params.filter((p) => p.in === 'query')
  const missingPath = pathParams.filter((p) => !pathValues[p.name])
  const missingQuery = queryParams.filter((p) => p.required && !queryValues[p.name])
  const missingRequired = [...missingPath, ...missingQuery]
  const canSend = isAuthenticated && missingRequired.length === 0 && !sending
  const livePreviewUrl = '/api' + substitutePath(meta.path, pathValues)

  async function doSend() {
    setSending(true)
    setError(null)
    try {
      const req = buildRequest(meta, values, accessToken)
      const res = await executeRequest(req)
      setResult(res)
      onResponseStatus(String(res.status))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSending(false)
      // Close the confirm modal only AFTER the request settles, so its busy /
      // 'Sending…' state is visible while in flight (no-op for non-mutating sends).
      setConfirmOpen(false)
    }
  }

  function onSendClick() {
    if (!canSend) return
    if (isMutating(meta.method)) setConfirmOpen(true)
    else void doSend()
  }

  return (
    <>
      <Disclosure title="Try it" defaultOpen className="bg-apt-bg">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-apt-border bg-apt-surface-2 px-3 py-2">
            <MethodBadge method={meta.method} />
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-apt-text" title={livePreviewUrl}>
              {livePreviewUrl}
            </code>
            <Button size="sm" onClick={onSendClick} disabled={!canSend}>
              {sending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}
              Send
            </Button>
          </div>

          {!isAuthenticated && <p className="text-sm text-apt-orange">Sign in to try this endpoint as yourself.</p>}
          {isAuthenticated && (
            <p className="text-xs text-apt-text-dim">
              Sent as you — <span className="font-mono">Authorization: Bearer</span> is attached from your session.
            </p>
          )}
          {missingRequired.length > 0 && (
            <p className="text-xs text-apt-text-muted">
              Fill required param{missingRequired.length > 1 ? 's' : ''}: {missingRequired.map((p) => p.name).join(', ')}
            </p>
          )}

          {(pathParams.length > 0 || queryParams.length > 0) && (
            <FieldGroup title="Parameters">
              {pathParams.map((p) => (
                <Field key={p.name} label={`${p.name} · path`} hint={p.description} error={!pathValues[p.name] ? 'Required' : undefined}>
                  <ParamInput param={p} value={pathValues[p.name] ?? ''} onChange={(v) => setPathValues((s) => ({ ...s, [p.name]: v }))} />
                </Field>
              ))}
              {queryParams.map((p) => (
                <Field
                  key={p.name}
                  label={`${p.name} · query${p.required ? '' : '?'}`}
                  hint={p.description}
                  error={p.required && !queryValues[p.name] ? 'Required' : undefined}
                >
                  <ParamInput param={p} value={queryValues[p.name] ?? ''} onChange={(v) => setQueryValues((s) => ({ ...s, [p.name]: v }))} />
                </Field>
              ))}
            </FieldGroup>
          )}

          {bodyAllowed(meta) && (
            <FieldGroup title="Request body">
              <Field label="application/json" hint={meta.requestBody?.required ? 'Required.' : 'Optional.'}>
                <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} spellCheck={false} className="min-h-40 font-mono text-sm" />
              </Field>
            </FieldGroup>
          )}

          {/* Result — always present, empty until the first Send. */}
          <div className="flex flex-col gap-2 rounded-lg border border-apt-border bg-apt-surface p-3">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-apt-text-muted">Result</span>
            {error ? (
              <p className="text-sm text-apt-red">{error}</p>
            ) : result ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn('font-mono font-semibold', statusTone(String(result.status)))}>
                    {result.status} {result.statusText}
                  </span>
                  <span className="text-apt-text-dim">·</span>
                  <span className="text-apt-text-muted">{result.durationMs} ms</span>
                </div>
                <CodeBlock code={prettyJson(result.bodyText).text || '(empty response body)'} lang="json" ariaLabel="Response body" />
              </>
            ) : (
              <p className="text-sm text-apt-text-dim">Send the request to see the response here.</p>
            )}
          </div>
        </div>
      </Disclosure>

      <AlertModal
        open={confirmOpen}
        title={`Run ${meta.method} as yourself?`}
        description={`This calls ${meta.method} ${meta.path} with your credentials and really modifies data — the same as changing it through the site.`}
        confirmLabel={sending ? 'Sending…' : `Send ${meta.method}`}
        cancelLabel="Cancel"
        destructive={meta.method === 'DELETE'}
        busy={sending}
        onConfirm={() => void doSend()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
