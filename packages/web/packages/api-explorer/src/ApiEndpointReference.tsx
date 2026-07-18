// NO 'use client' — a server component. The read-only reference for ONE endpoint, fully rendered
// on the server (crawlable, code pre-highlighted): Overview, Parameters, Request body, Responses,
// and Code examples. This is the SSR counterpart to the client, interactive ApiEndpointDetail
// (which keeps its disclosures + "Try it" panel for authenticated surfaces); here every section is
// expanded and static so the whole endpoint is in the initial HTML.

import { cn } from '@agentic-toolkit/ui'
import { describeFields, schemaToExample, typeLabel } from './lib/schema'
import { snippetFor, SNIPPET_LANGS, PUBLIC_API_ORIGIN } from './lib/snippets'
import { methodBadgeClass, statusTone } from './lib/tone'
import { StaticCodeBlock } from './StaticCodeBlock'
import type { EndpointMeta, EndpointParam, EndpointResponse, JsonSchema } from './types'

export interface ApiEndpointReferenceProps {
  meta: EndpointMeta
  /** Public API origin shown in the code snippets (defaults to prod). */
  apiOrigin?: string
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-apt-border bg-apt-bg">
      <div className="border-b border-apt-border px-3 py-2 text-sm font-medium text-apt-text">{title}</div>
      <div className="flex flex-col gap-3 px-3 py-3">{children}</div>
    </section>
  )
}

/** A read-only field list for a response/request-body schema (name · optional · type + description). */
function SchemaFieldList({ schema }: { schema: JsonSchema | undefined }) {
  const fields = describeFields(schema)
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

/** The path/query parameters as a read-only list (the interactive panel turns these into inputs). */
function ParamList({ params }: { params: EndpointParam[] }) {
  return (
    <ul className="divide-y divide-apt-border/60 rounded-lg border border-apt-border">
      {params.map((p) => (
        <li key={`${p.in}:${p.name}`} className="flex flex-col gap-0.5 px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm text-apt-text">{p.name}</span>
            <span className="text-xs text-apt-text-dim">
              {p.in}
              {p.required ? '' : ' · optional'}
            </span>
            <span className="ml-auto font-mono text-xs text-apt-text-muted">{typeLabel(p.schema)}</span>
          </div>
          {p.description && <p className="text-xs text-apt-text-muted">{p.description}</p>}
        </li>
      ))}
    </ul>
  )
}

export function ApiEndpointReference({ meta, apiOrigin = PUBLIC_API_ORIGIN }: ApiEndpointReferenceProps) {
  const pathParams = meta.params.filter((p) => p.in === 'path')
  const queryParams = meta.params.filter((p) => p.in === 'query')
  const hasParams = pathParams.length > 0 || queryParams.length > 0

  // Read-only default values for the code snippets: no user input, so path/query placeholders stay
  // as `{param}` and the body is the schema example (matching the interactive pane's initial state).
  const values = {
    pathValues: {} as Record<string, string>,
    queryValues: {} as Record<string, string>,
    body: meta.requestBody ? JSON.stringify(schemaToExample(meta.requestBody.schema), null, 2) : '',
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title="Overview">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-apt-border bg-apt-surface-2 px-3 py-2">
          <MethodBadge method={meta.method} />
          <code className="break-all font-mono text-sm text-apt-text">{meta.path}</code>
          {meta.tag && (
            <span className="rounded-md border border-apt-border bg-apt-surface px-2 py-0.5 text-xs text-apt-text-muted">
              {meta.tag}
            </span>
          )}
        </div>
        {meta.summary && <h2 className="text-base font-semibold leading-snug text-apt-text">{meta.summary}</h2>}
        {meta.description && <p className="whitespace-pre-line text-sm text-apt-text-muted">{meta.description}</p>}
        {meta.security && meta.security.length > 0 && (
          <p className="text-xs text-apt-text-dim">
            Auth: <span className="font-mono">{meta.security.join(', ')}</span> — calls run as the authenticated user.
          </p>
        )}
      </Section>

      {hasParams && (
        <Section title="Parameters">
          <ParamList params={[...pathParams, ...queryParams]} />
        </Section>
      )}

      {meta.requestBody && (
        <Section title="Request body">
          <p className="text-xs text-apt-text-dim">
            <span className="font-mono">{meta.requestBody.contentType}</span>
            {meta.requestBody.required ? ' · required' : ' · optional'}
          </p>
          <SchemaFieldList schema={meta.requestBody.schema} />
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-xs uppercase tracking-wider text-apt-text-muted">Example</span>
            <StaticCodeBlock code={JSON.stringify(schemaToExample(meta.requestBody.schema), null, 2)} lang="json" ariaLabel="Example request body" />
          </div>
        </Section>
      )}

      {meta.responses.length > 0 && (
        <Section title="Responses">
          {meta.responses.map((r: EndpointResponse) => (
            <div key={r.status} className="flex flex-col gap-2 rounded-lg border border-apt-border bg-apt-surface p-3">
              <span className={cn('font-mono text-sm font-semibold', statusTone(r.status))}>{r.status}</span>
              {r.description && <p className="text-sm text-apt-text-muted">{r.description}</p>}
              {r.schema ? (
                <>
                  <SchemaFieldList schema={r.schema} />
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-xs uppercase tracking-wider text-apt-text-muted">Example</span>
                    <StaticCodeBlock code={JSON.stringify(schemaToExample(r.schema), null, 2)} lang="json" ariaLabel={`Example ${r.status} body`} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-apt-text-dim">No response body.</p>
              )}
            </div>
          ))}
        </Section>
      )}

      <Section title="Code examples">
        {SNIPPET_LANGS.map((l) => (
          <div key={l.id} className="flex flex-col gap-1.5">
            <span className="font-mono text-xs uppercase tracking-wider text-apt-text-muted">{l.label}</span>
            <StaticCodeBlock code={snippetFor(l.id, meta, values, apiOrigin)} lang={l.highlight} ariaLabel={`${l.label} snippet`} />
          </div>
        ))}
      </Section>
    </div>
  )
}
