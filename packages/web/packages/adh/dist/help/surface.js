// src/help/HelpSurface.tsx
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";

// src/docs/MarkdownHtml.tsx
import { jsx } from "react/jsx-runtime";
function MarkdownHtml({ html, className }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: className ? `adh-mv-prose ${className}` : "adh-mv-prose",
      dangerouslySetInnerHTML: { __html: html }
    }
  );
}

// src/help/content.generated.ts
var HELP_CONTENT_HTML = {
  "changelog": `<h1 id="changelog"><a href="#changelog">Changelog</a></h1>
<p>This page lists user-visible changes to the Agentic Developer Hub API.
Internal refactors that don't affect callers are omitted.</p>
<h2 id="unreleased"><a href="#unreleased">Unreleased</a></h2>
<p><em>The public API is pre-1.0. Breaking changes will be called out here as they
land. Endpoint schemas are the source of truth \u2014 see the
<a href="https://api.agenticdeveloperhub.com">API reference</a>.</em></p>`,
  "errors": `<h1 id="errors"><a href="#errors">Errors</a></h1>
<p>The API returns JSON error responses with a consistent shape. The HTTP
status code is the primary signal; the body provides a machine-readable
<code>code</code> and a human-readable <code>message</code>.</p>
<h2 id="response-shape"><a href="#response-shape">Response shape</a></h2>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">{</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "code"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"validation_error"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "message"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"redirect_uri must be one of the URIs registered for this client"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "field"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"redirect_uri"</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">}</span></span></code></pre>
<table>
<thead>
<tr>
<th>Field</th>
<th>Type</th>
<th>Notes</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>code</code></td>
<td><code>string</code></td>
<td>Stable machine-readable identifier (snake_case)</td>
</tr>
<tr>
<td><code>message</code></td>
<td><code>string</code></td>
<td>Human-readable explanation, may change between versions</td>
</tr>
<tr>
<td><code>field</code></td>
<td><code>string?</code></td>
<td>Set on <code>400</code> validation errors; identifies the offending field</td>
</tr>
</tbody>
</table>
<p>Always switch on <code>code</code>, not <code>message</code>.</p>
<h2 id="common-status-codes"><a href="#common-status-codes">Common status codes</a></h2>
<table>
<thead>
<tr>
<th>HTTP</th>
<th>Meaning</th>
<th>What to do</th>
</tr>
</thead>
<tbody>
<tr>
<td>400</td>
<td>Validation / bad request</td>
<td>Fix the request and retry</td>
</tr>
<tr>
<td>401</td>
<td>Missing / invalid auth</td>
<td>Refresh the token, or re-authorize</td>
</tr>
<tr>
<td>403</td>
<td>Authenticated but no permission</td>
<td>Don't retry; user needs the right scope or role</td>
</tr>
<tr>
<td>404</td>
<td>Resource not found</td>
<td>Confirm the ID; don't retry</td>
</tr>
<tr>
<td>409</td>
<td>Conflict (e.g., duplicate)</td>
<td>Inspect the error and adapt</td>
</tr>
<tr>
<td>429</td>
<td>Rate limited</td>
<td>Back off; check <code>Retry-After</code></td>
</tr>
<tr>
<td>500</td>
<td>Server error</td>
<td>Retry with exponential backoff; if persistent, report it</td>
</tr>
</tbody>
</table>
<h2 id="retry-guidance"><a href="#retry-guidance">Retry guidance</a></h2>
<ul>
<li><strong>Idempotent verbs</strong> (<code>GET</code>, <code>PUT</code>, <code>DELETE</code>) \u2014 retry safely on 5xx and
network errors.</li>
<li><strong><code>POST</code></strong> \u2014 retry only if you set <code>Idempotency-Key</code> (see the
<a href="https://api.agenticdeveloperhub.com">API reference</a>) or you can otherwise
guarantee the operation is idempotent.</li>
<li><strong>Rate limits</strong> \u2014 honour <code>Retry-After</code> (seconds). Don't retry faster than
the server tells you to.</li>
</ul>
<h2 id="reporting-bugs"><a href="#reporting-bugs">Reporting bugs</a></h2>
<p>If the response looks like a server-side bug (5xx without a clear cause,
unexpected <code>400</code>), include the <code>code</code>, the request ID from the
<code>X-Request-Id</code> response header, and a minimal repro in your report.</p>`,
  "hub-apis": '<h1 id="apis--agents"><a href="#apis--agents">APIs &#x26; agents</a></h1>\n<p>Everything you can do in the Hub is available to code and to agents:</p>\n<ul>\n<li><strong><a href="/rest-api">REST API</a></strong> \u2014 an OpenAPI 3.1 surface for every resource.</li>\n<li><strong><a href="/mcp">MCP server</a></strong> \u2014 connect an AI agent over the Model Context Protocol\nto a curated tool set.</li>\n<li><strong><a href="/quickstart/oauth/overview">OAuth</a></strong> \u2014 authorize on behalf of a user.</li>\n<li><strong>Tools</strong> \u2014 define reusable, typed capabilities once and expose them to any\npersona over REST and MCP.</li>\n</ul>',
  "hub-community": '<h1 id="community--support"><a href="#community--support">Community &#x26; support</a></h1>\n<p>Where the Agentic Developer Community talks \u2014 and where you get help.</p>\n<ul>\n<li><strong>Discussions</strong> \u2014 the Agentic Developer Community forum: topics, threads, and a\nmember directory.</li>\n<li><strong>Support</strong> \u2014 searchable answers first, then ticketed help tied to your account.</li>\n<li><strong>News</strong> \u2014 releases and stories, subscribable by RSS or email.</li>\n<li><strong>Messaging</strong> \u2014 direct messages and a notification inbox (enabled per ecosystem).</li>\n</ul>',
  "hub-monitoring": `<h1 id="monitoring"><a href="#monitoring">Monitoring</a></h1>
<p>Watch the things you've shipped from one place.</p>
<ul>
<li><strong>Dashboards</strong> \u2014 register the sites and endpoints you want watched, group them,
and track uptime and status in one view.</li>
</ul>`,
  "hub-overview": '<h1 id="hub-features"><a href="#hub-features">Hub Features</a></h1>\n<p>The Agentic Developer Hub is your workspace for building with personas, data, and\nagents. You always work inside a <strong>workspace</strong> \u2014 your personal one, or an\norganization or team you belong to \u2014 and every feature is scoped to that\nworkspace, or to a product within it.</p>\n<div class="adh-mv-alert adh-mv-alert--note">\n<p class="adh-mv-alert-title">Note</p>\n<p>New here? Start with the <a href="/quickstart">Quickstart</a> to register an app, mint\na token, and make your first call.</p>\n</div>\n<p>Browse the areas from the Hub Features menu: workspaces and account, personas,\nproducts, storage and data, planning, teams, community and support, monitoring,\nand the APIs that expose it all to code and agents.</p>',
  "hub-personas": `<h1 id="personas"><a href="#personas">Personas</a></h1>
<p>Design, register, and run AI personas.</p>
<ul>
<li><strong>Persona editor</strong> \u2014 identity, bio and avatar, capabilities, and model
preferences, kept under version control so you can inspect, diff, and pin a
revision.</li>
<li><strong>Persona Services</strong> \u2014 connect the LLM and provider accounts a persona calls.</li>
<li><strong>Persona Data Store</strong> \u2014 per-project, versioned storage for a persona's prompts,
configs, and memory.</li>
<li><strong>Knowledge Bases</strong> \u2014 ingest documents into searchable, citable stores an agent
can ground its answers in.</li>
<li><strong>Public profiles</strong> \u2014 every registered persona gets a shareable profile on the
Persona Registry, doubling as a character sheet with levels, badges, and
leaderboards.</li>
</ul>`,
  "hub-plan": '<h1 id="plan"><a href="#plan">Plan</a></h1>\n<p>Organize and narrate the work behind what you build.</p>\n<ul>\n<li><strong>Projects</strong> \u2014 organize the work behind what you build, with <strong>Plans</strong> and\n<strong>Tasks</strong>; agents can read and update work items over the <a href="/rest-api">API</a> and\n<a href="/mcp">MCP</a>.</li>\n<li><strong>Narratives</strong> \u2014 synthesize a shareable story from your git history, docs, and\nnotes.</li>\n<li><strong>Research</strong> \u2014 a shared, searchable notebook of markdown research documents.</li>\n</ul>',
  "hub-products": `<h1 id="products"><a href="#products">Products</a></h1>
<p>Each product you build is an <strong>ecosystem</strong> with its own settings, project, and data.
Inside a product you manage:</p>
<ul>
<li><strong>Applications</strong> and <strong>API tokens</strong> scoped to the product.</li>
<li><strong>Storage</strong>, <strong>Integrations</strong>, and <strong>Dashboards</strong> for the product's data.</li>
<li><strong>Users</strong> \u2014 your product's customers: invites, requests, and pending members.</li>
<li><strong>Sign-in apps</strong> \u2014 let your own site sign its customers in through ADH (OAuth you
don't have to build).</li>
<li><strong>Feature flags</strong> and <strong>server bags</strong> \u2014 runtime on/off toggles and key\u2192JSON config
your apps read.</li>
<li><strong>Gamification</strong> \u2014 turn on the character-sheet system (levels, badges, seasons)
for your personas.</li>
</ul>`,
  "hub-storage": '<h1 id="storage--data"><a href="#storage--data">Storage &#x26; data</a></h1>\n<p>Store, permission, and browse the data behind your workspace and products.</p>\n<ul>\n<li><strong>Buckets</strong> \u2014 named, permissioned collections that expose selected tables and rows\n(buckets nest, and every ecosystem gets a default one).</li>\n<li><strong>Files</strong> \u2014 upload, browse, and serve files with signed reads.</li>\n<li><strong>Access &#x26; usage</strong> \u2014 per-bucket permission lists and usage trends.</li>\n<li><strong>All Data</strong> \u2014 a cross-schema browser to read and edit the underlying records\ndirectly.</li>\n<li><strong>Integrations</strong> \u2014 connect third-party accounts (OAuth or Plaid) that sync data\ninto your workspace.</li>\n</ul>',
  "hub-teams": '<h1 id="teams"><a href="#teams">Teams</a></h1>\n<p>Group members into teams, and compose agentic teams from personas.</p>\n<ul>\n<li><strong>Teams</strong> \u2014 group members into teams within a workspace.</li>\n<li><strong>Team Registry</strong> \u2014 a public, claimable profile for a registered agentic team.</li>\n<li><strong>Team Builder</strong> \u2014 compose a team from existing personas, define roles and\nhand-offs, and publish it.</li>\n</ul>',
  "hub-workspaces": `<h1 id="workspaces--account"><a href="#workspaces--account">Workspaces &#x26; account</a></h1>
<p>Switch between your personal workspace and any organization or team you belong to,
and create a new organization from Home.</p>
<ul>
<li><strong>Settings</strong> \u2014 appearance, account, security, subscription, your public profile,
notifications, and <strong>API tokens</strong>.</li>
<li><strong>Members</strong> \u2014 an organization's people roster.</li>
<li><strong>Tokens</strong> \u2014 mint, list, and revoke storage-access tokens; each one gets its own
default bucket.</li>
</ul>`,
  "mcp-connect": `<h1 id="connect-your-client"><a href="#connect-your-client">Connect your client</a></h1>
<div class="adh-mv-alert adh-mv-alert--note">
<p class="adh-mv-alert-title">Note</p>
<p>Mint an API token first: <code>POST /auth/tokens</code> with your JWT (or via the web
app's API-tokens screen). The raw value is shown <strong>once</strong>.</p>
</div>
<h2 id="claude-desktop"><a href="#claude-desktop">Claude Desktop</a></h2>
<p>Edit <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS)
or <code>%APPDATA%\\Claude\\claude_desktop_config.json</code> (Windows). Restart Claude
Desktop.</p>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">{</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "mcpServers"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: {</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">    "agentic-developer-hub"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: {</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">      "type"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"streamable-http"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">      "url"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"https://mcp.agenticdeveloperhub.com/mcp"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">      "headers"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: {</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">        "Authorization"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"Bearer &#x3C;paste-token>"</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      }</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">    }</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  }</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">}</span></span></code></pre>
<h2 id="claude-code"><a href="#claude-code">Claude Code</a></h2>
<p>From the command line:</p>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">claude</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> mcp</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> add</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> --transport</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> http</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> agentic-developer-hub</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> \\</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">  https://mcp.agenticdeveloperhub.com/mcp</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> \\</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  --header</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> "Authorization: Bearer &#x3C;paste-token>"</span></span></code></pre>
<h2 id="cursor"><a href="#cursor">Cursor</a></h2>
<p>Edit <code>~/.cursor/mcp.json</code> (or Cursor Settings \u2192 MCP). Restart Cursor.</p>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">{</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "mcpServers"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: {</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">    "agentic-developer-hub"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: {</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">      "url"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"https://mcp.agenticdeveloperhub.com/mcp"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">      "headers"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: {</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">        "Authorization"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"Bearer &#x3C;paste-token>"</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      }</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">    }</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  }</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">}</span></span></code></pre>
<h2 id="mcp-inspector"><a href="#mcp-inspector">MCP Inspector</a></h2>
<p>For debugging \u2014 a web UI that lets you call tools by hand:</p>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">npx</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> -y</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> @modelcontextprotocol/inspector</span></span></code></pre>
<p>Then connect with transport <code>streamable-http</code>, URL
<code>https://mcp.agenticdeveloperhub.com/mcp</code>, and an <code>Authorization: Bearer \u2026</code>
header.</p>`,
  "mcp-details": '<h1 id="details"><a href="#details">Details</a></h1>\n<table>\n<thead>\n<tr>\n<th></th>\n<th></th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td><strong>Transport</strong></td>\n<td>Streamable HTTP (stateless)</td>\n</tr>\n<tr>\n<td><strong>Endpoint</strong></td>\n<td><code>POST https://mcp.agenticdeveloperhub.com/mcp</code></td>\n</tr>\n<tr>\n<td><strong>Auth</strong></td>\n<td><code>Authorization: Bearer &#x3C;api-token></code></td>\n</tr>\n<tr>\n<td><strong>Session</strong></td>\n<td>Stateless \u2014 each request re-validates the token</td>\n</tr>\n<tr>\n<td><strong>Data scope</strong></td>\n<td>Limited to the user the token belongs to</td>\n</tr>\n</tbody>\n</table>',
  "mcp-overview": `<h1 id="mcp-server"><a href="#mcp-server">MCP Server</a></h1>
<p>A Model Context Protocol endpoint. Your AI agent connects here over Streamable
HTTP and gets a curated set of tools to call against your authenticated data.</p>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span>POST https://mcp.agenticdeveloperhub.com/mcp</span></span></code></pre>
<h2 id="what-this-is"><a href="#what-this-is">What this is</a></h2>
<p>MCP is a protocol for AI agents to discover and call tools on a server. It's a
sibling of the REST API, not a replacement.</p>
<h3 id="mcp--this-server"><a href="#mcp--this-server">MCP \u2014 this server</a></h3>
<ul>
<li>For LLM agents, not browsers</li>
<li>Single endpoint (<code>POST /mcp</code>)</li>
<li>JSON-RPC over HTTP</li>
<li>Tool discovery built in (<code>tools/list</code>)</li>
<li>Auth: <code>Authorization: Bearer &#x3C;api-token></code></li>
</ul>
<h3 id="rest-api"><a href="#rest-api">REST API</a></h3>
<ul>
<li>For humans and traditional clients</li>
<li>Resource-oriented (<code>/\u2026</code>)</li>
<li>OpenAPI 3.1 spec \u2014 see the <a href="/rest-api">API reference</a></li>
<li>Auth: JWT (email/password or OAuth)</li>
</ul>`,
  "mcp-tools": `<h1 id="tool-surface"><a href="#tool-surface">Tool surface</a></h1>
<p>54 tools, scoped to the user behind the API token. Revoke a token
to cut access immediately. Profile tools return only rows the acting agent has
been granted read access to via the data bucket ACL.</p>
<h2 id="persona-storage--19-tools"><a href="#persona-storage--19-tools">Persona Storage \xB7 19 tools</a></h2>
<p>Key/value, lists, counters, memory, events, queues, and keyword tags \u2014 agent-managed structured state.</p>
<table>
<thead>
<tr>
<th>Tool</th>
<th>Access</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>dataKvGet</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>dataKvSet</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataKvDelete</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataCounterGet</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>dataCounterIncr</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataListGet</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>dataListAppend</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataListRemove</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataMemoryGet</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>dataMemorySet</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataEventAppend</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataEventQuery</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>dataQueueEnqueue</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataQueueDequeue</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataQueueAck</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataQueueNack</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataKeywordTag</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataKeywordUntag</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>dataKeywordSearch</code></td>
<td>Read</td>
</tr>
</tbody>
</table>
<h2 id="discussions--4-tools"><a href="#discussions--4-tools">Discussions \xB7 4 tools</a></h2>
<p>Search and browse the community forum.</p>
<table>
<thead>
<tr>
<th>Tool</th>
<th>Access</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>searchThreads</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>listCategories</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getMyBookmarks</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getRecentNotifications</code></td>
<td>Read</td>
</tr>
</tbody>
</table>
<h2 id="profile--12-tools"><a href="#profile--12-tools">Profile \xB7 12 tools</a></h2>
<p>Your structured profile \u2014 jobs, education, locations, contacts, relationships, dates, tags, notes \u2014 plus categories and keyword lookups. Returns only rows the acting agent has been granted read access to via the data bucket ACL.</p>
<table>
<thead>
<tr>
<th>Tool</th>
<th>Access</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>getMyProfile</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getMyJobs</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getMyEducation</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getMyLocations</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getMyContacts</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getMyRelationships</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getMyTags</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getMyDates</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>searchMyNotes</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>searchMyData</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getCategoryContents</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>getKeywordsFor</code></td>
<td>Read</td>
</tr>
</tbody>
</table>
<h2 id="personas--2-tools"><a href="#personas--2-tools">Personas \xB7 2 tools</a></h2>
<p>Discover personas visible to you.</p>
<table>
<thead>
<tr>
<th>Tool</th>
<th>Access</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>personasPersonaList</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>personasPersonaGet</code></td>
<td>Read</td>
</tr>
</tbody>
</table>
<h2 id="teams--3-tools"><a href="#teams--3-tools">Teams \xB7 3 tools</a></h2>
<p>Administer the rosters of teams you manage \u2014 for an organization persona, the org-owned teams (list, add by email, remove).</p>
<table>
<thead>
<tr>
<th>Tool</th>
<th>Access</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>teamMemberList</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>teamMemberAdd</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>teamMemberRemove</code></td>
<td>Write</td>
</tr>
</tbody>
</table>
<h2 id="monitored-sites--7-tools"><a href="#monitored-sites--7-tools">Monitored Sites \xB7 7 tools</a></h2>
<p>Manage uptime monitors for your sites and HTTP endpoints.</p>
<table>
<thead>
<tr>
<th>Tool</th>
<th>Access</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>monitoredSiteList</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>monitoredSiteAdd</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>monitoredSiteRemove</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>monitoredEndpointList</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>monitoredEndpointAdd</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>monitoredEndpointRemove</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>monitoredEndpointStatus</code></td>
<td>Read</td>
</tr>
</tbody>
</table>
<h2 id="projects--6-tools"><a href="#projects--6-tools">Projects \xB7 6 tools</a></h2>
<p>List projects, their iterations and their work items, update a work item \u2014 including committing it to an iteration and sizing it \u2014 and post a comment: the agent write surface for the Projects feature (acts as the token subject).</p>
<table>
<thead>
<tr>
<th>Tool</th>
<th>Access</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>projectListProjects</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>projectListIterations</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>projectListWorkItems</code></td>
<td>Read</td>
</tr>
<tr>
<td><code>projectUpdateWorkItem</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>projectAddComment</code></td>
<td>Write</td>
</tr>
<tr>
<td><code>projectListComments</code></td>
<td>Read</td>
</tr>
</tbody>
</table>
<h2 id="persona-knowledge--1-tools"><a href="#persona-knowledge--1-tools">Persona Knowledge \xB7 1 tools</a></h2>
<p>Full-text search over the acting persona's OWN knowledge corpus \u2014 the markdown rows referenced by a row-mode bucket type it has been granted read access to. Returns keyword-centred excerpts, never whole documents.</p>
<table>
<thead>
<tr>
<th>Tool</th>
<th>Access</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>searchPersonaKnowledge</code></td>
<td>Read</td>
</tr>
</tbody>
</table>`,
  "oauth-authorize": `<h1 id="2-send-the-user-to-authorize"><a href="#2-send-the-user-to-authorize">2. Send the user to authorize</a></h1>
<p>In this step your app redirects the user to the Agentic Developer Hub
authorization endpoint. The user signs in, sees a consent screen listing the
scopes you requested, and clicks <strong>Approve</strong>. We send them back to your
<code>redirect_uri</code> with a one-time <code>code</code> you'll exchange for tokens in
<a href="/quickstart/oauth/token-exchange">Step 3</a>.</p>
<h2 id="generate-a-pkce-pair"><a href="#generate-a-pkce-pair">Generate a PKCE pair</a></h2>
<p>PKCE protects against intercepted authorization codes. Generate a
<strong>verifier</strong> (random string you keep) and a <strong>challenge</strong> (SHA-256 of the
verifier, base64url-encoded) for every authorization request.</p>
<h3 id="typescript"><a href="#typescript">TypeScript</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">function</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> base64url</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70">buf</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> ArrayBuffer</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> {</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">  return</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> btoa</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(String.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">fromCharCode</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">...new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> Uint8Array</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(buf)))</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">    .</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">replace</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">/</span><span style="--shiki-light:#032F62;--shiki-dark:#DBEDFF">=</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">/</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">g</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">''</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">).</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">replace</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">/</span><span style="--shiki-light:#22863A;--shiki-light-font-weight:bold;--shiki-dark:#85E89D;--shiki-dark-font-weight:bold">\\+</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">/</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">g</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'-'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">).</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">replace</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">/</span><span style="--shiki-light:#22863A;--shiki-light-font-weight:bold;--shiki-dark:#85E89D;--shiki-dark-font-weight:bold">\\/</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">/</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">g</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'_'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">);</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">}</span></span>
<span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">async</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> function</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> generatePKCE</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">() {</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> bytes</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> crypto.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">getRandomValues</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> Uint8Array</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">32</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">));</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> verifier</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> base64url</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(bytes.buffer);</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> challenge</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> base64url</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">    await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> crypto.subtle.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">digest</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'SHA-256'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> TextEncoder</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">().</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">encode</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(verifier))</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  );</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">  return</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> { verifier, challenge };</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">}</span></span></code></pre>
<h3 id="swift"><a href="#swift">Swift</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span>import CryptoKit</span></span>
<span><span></span></span>
<span><span>extension Data {</span></span>
<span><span>    func base64URLEncoded() -> String {</span></span>
<span><span>        base64EncodedString()</span></span>
<span><span>            .replacingOccurrences(of: "+", with: "-")</span></span>
<span><span>            .replacingOccurrences(of: "/", with: "_")</span></span>
<span><span>            .replacingOccurrences(of: "=", with: "")</span></span>
<span><span>    }</span></span>
<span><span>}</span></span>
<span><span></span></span>
<span><span>func generatePKCE() -> (verifier: String, challenge: String) {</span></span>
<span><span>    var bytes = [UInt8](repeating: 0, count: 32)</span></span>
<span><span>    _ = SecRandomCopyBytes(kSecRandomDefault, 32, &#x26;bytes)</span></span>
<span><span>    let verifier = Data(bytes).base64URLEncoded()</span></span>
<span><span>    let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncoded()</span></span>
<span><span>    return (verifier, challenge)</span></span>
<span><span>}</span></span></code></pre>
<h3 id="kotlin"><a href="#kotlin">Kotlin</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span>import java.security.MessageDigest</span></span>
<span><span>import java.security.SecureRandom</span></span>
<span><span>import java.util.Base64</span></span>
<span><span></span></span>
<span><span>fun generatePKCE(): Pair&#x3C;String, String> {</span></span>
<span><span>    val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }</span></span>
<span><span>    val verifier = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)</span></span>
<span><span>    val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(</span></span>
<span><span>        MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray())</span></span>
<span><span>    )</span></span>
<span><span>    return verifier to challenge</span></span>
<span><span>}</span></span></code></pre>
<p>Store the <code>verifier</code> in the user's session \u2014 you'll need it for the token
exchange.</p>
<h2 id="redirect-the-user"><a href="#redirect-the-user">Redirect the user</a></h2>
<p>Build a URL with the <code>client_id</code>, the <code>redirect_uri</code>, the requested
<code>scope</code>s, a <code>state</code> parameter (random, anti-CSRF), and the PKCE
<code>code_challenge</code>.</p>
<h3 id="curl"><a href="#curl">curl</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">open</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> "https://api.agenticdeveloperhub.com/api/oauth/signin/start</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">\\</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">?client_id=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$ADH_CLIENT_ID</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">\\</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">&#x26;redirect_uri=https%3A%2F%2Fyour.app%2Fcallback</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">\\</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">&#x26;response_type=code</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">\\</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">&#x26;scope=profile%3Aread%20discussions%3Aread</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">\\</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">&#x26;state=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$RANDOM_STATE</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">\\</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">&#x26;code_challenge=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$PKCE_CHALLENGE</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">\\</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">&#x26;code_challenge_method=S256"</span></span></code></pre>
<h3 id="typescript-1"><a href="#typescript-1">TypeScript</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> url</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> URL</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'https://api.agenticdeveloperhub.com/api/oauth/signin/start'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">);</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">url.searchParams.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">set</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'client_id'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, clientId);</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">url.searchParams.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">set</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'redirect_uri'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'https://your.app/callback'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">);</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">url.searchParams.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">set</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'response_type'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'code'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">);</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">url.searchParams.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">set</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'scope'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'profile:read discussions:read'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">);</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">url.searchParams.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">set</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'state'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, state);</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">url.searchParams.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">set</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'code_challenge'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, challenge);</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">url.searchParams.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">set</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'code_challenge_method'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'S256'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">);</span></span>
<span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">window.location.href </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> url.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">toString</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">();</span></span></code></pre>
<div class="adh-mv-alert adh-mv-alert--warning">
<p class="adh-mv-alert-title">Warning</p>
<p>The <code>state</code> parameter prevents CSRF attacks on the redirect. Generate a
fresh random string per request, store it in the user's session, and
<strong>reject</strong> the callback if the returned <code>state</code> doesn't match.</p>
</div>
<h2 id="handle-the-redirect"><a href="#handle-the-redirect">Handle the redirect</a></h2>
<p>After the user approves, we send them back to your <code>redirect_uri</code> with
<code>?code=\u2026&#x26;state=\u2026</code> query parameters.</p>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span>https://your.app/callback?code=AUTH_CODE_HERE&#x26;state=SAME_STATE</span></span></code></pre>
<p>Verify the <code>state</code> matches what you stored, then exchange the <code>code</code> for
tokens in the next step.</p>
<h2 id="next"><a href="#next">Next</a></h2>
<p>\u2192 <a href="/quickstart/oauth/token-exchange">Step 3: Exchange the code for tokens</a></p>`,
  "oauth-overview": `<h1 id="oauth-overview"><a href="#oauth-overview">OAuth overview</a></h1>
<p>Use OAuth when your application acts <strong>on behalf of a user</strong> \u2014 reading their
data, posting on their behalf, or otherwise needing their explicit consent.</p>
<p>If you only need to authenticate your own server-to-server traffic, use a
personal <a href="/quickstart">API token</a> instead.</p>
<h2 id="the-flow-at-a-glance"><a href="#the-flow-at-a-glance">The flow at a glance</a></h2>
<p>The Agentic Developer Hub uses the standard OAuth 2.0 <strong>Authorization Code</strong>
flow with <strong>PKCE</strong>. Four steps:</p>
<ol>
<li><strong><a href="/quickstart/oauth/register-app">Register your app</a></strong> \u2014 get a <code>client_id</code>
and configure a <code>redirect_uri</code>.</li>
<li><strong><a href="/quickstart/oauth/authorize">Send the user to authorize</a></strong> \u2014 redirect the
user to <code>/api/oauth/signin/start</code>. They sign in and approve scopes.</li>
<li><strong><a href="/quickstart/oauth/token-exchange">Exchange the code for tokens</a></strong> \u2014 your
server POSTs the returned code to <code>/api/oauth/signin/exchange</code> and receives an
access token + refresh token.</li>
<li><strong><a href="/quickstart/oauth/refresh">Refresh when the token expires</a></strong> \u2014 exchange a
refresh token for a new access token at <code>/api/auth/refresh</code>.</li>
</ol>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span>\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2510                \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510               \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510</span></span>
<span><span>\u2502 User \u2502                \u2502 Your    \u2502               \u2502 Agentic      \u2502</span></span>
<span><span>\u2502      \u2502                \u2502 App     \u2502               \u2502 Developer    \u2502</span></span>
<span><span>\u2502      \u2502                \u2502         \u2502               \u2502 Hub          \u2502</span></span>
<span><span>\u2514\u2500\u2500\u252C\u2500\u2500\u2500\u2518                \u2514\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2518               \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518</span></span>
<span><span>   \u2502                         \u2502                            \u2502</span></span>
<span><span>   \u2502  1. Click "Connect"     \u2502                            \u2502</span></span>
<span><span>   \u2502 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502                            \u2502</span></span>
<span><span>   \u2502                         \u2502                            \u2502</span></span>
<span><span>   \u2502                         \u2502 2. Redirect to /auth/start \u2502</span></span>
<span><span>   \u2502 \u25C4\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524                            \u2502</span></span>
<span><span>   \u2502                                                      \u2502</span></span>
<span><span>   \u2502  3. Sign in &#x26; approve scopes                         \u2502</span></span>
<span><span>   \u2502 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502</span></span>
<span><span>   \u2502                                                      \u2502</span></span>
<span><span>   \u2502  4. Redirect back to your redirect_uri with ?code=\u2026  \u2502</span></span>
<span><span>   \u2502 \u25C4\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502</span></span>
<span><span>   \u2502                         \u2502                            \u2502</span></span>
<span><span>   \u2502                         \u2502 5. POST /auth/exchange     \u2502</span></span>
<span><span>   \u2502                         \u2502     {code, code_verifier}  \u2502</span></span>
<span><span>   \u2502                         \u2502 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502</span></span>
<span><span>   \u2502                         \u2502                            \u2502</span></span>
<span><span>   \u2502                         \u2502 6. {access_token,          \u2502</span></span>
<span><span>   \u2502                         \u2502     refresh_token,         \u2502</span></span>
<span><span>   \u2502                         \u2502     expires_in}            \u2502</span></span>
<span><span>   \u2502                         \u2502 \u25C4\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502</span></span>
<span><span>   \u2502                         \u2502                            \u2502</span></span></code></pre>
<h2 id="what-youll-need-before-you-start"><a href="#what-youll-need-before-you-start">What you'll need before you start</a></h2>
<ul>
<li>A registered application with a <code>client_id</code>. See
<a href="/quickstart/oauth/register-app">Register an app</a>.</li>
<li>A <code>redirect_uri</code> you control (an HTTPS URL on your domain, or
<code>http://localhost:&#x3C;port>/callback</code> during development).</li>
<li>A backend that can keep your <code>client_secret</code> server-side. The OAuth flow
itself uses PKCE so the secret never travels through the user's browser,
but anything you do post-token (refresh, revoke) must run server-side.</li>
</ul>
<h2 id="common-pitfalls"><a href="#common-pitfalls">Common pitfalls</a></h2>
<ul>
<li><strong>The redirect_uri must match exactly.</strong> Including the trailing slash, the
port, the scheme. The mismatch is the #1 reason <code>/auth/exchange</code> returns
<code>400</code>.</li>
<li><strong>PKCE <code>code_verifier</code> is required.</strong> This API rejects non-PKCE flows. See
<a href="/quickstart/oauth/authorize">Step 2</a> for how to generate the verifier and
challenge.</li>
<li><strong>Access tokens expire.</strong> Always handle the
<code>401 token_expired</code> response by refreshing \u2014 see
<a href="/quickstart/oauth/refresh">Step 4</a>.</li>
</ul>`,
  "oauth-refresh": `<h1 id="4-refresh-when-the-token-expires"><a href="#4-refresh-when-the-token-expires">4. Refresh when the token expires</a></h1>
<p>Access tokens expire after <code>expires_in</code> seconds (typically one hour). Use
the <code>refresh_token</code> from <a href="/quickstart/oauth/token-exchange">Step 3</a> to get a new
access token <strong>without</strong> redirecting the user again.</p>
<h2 id="when-to-refresh"><a href="#when-to-refresh">When to refresh</a></h2>
<p>Pick <strong>one</strong> strategy and stick to it:</p>
<ol>
<li><strong>Proactively</strong> \u2014 schedule a refresh ~60 seconds before <code>expires_in</code>.
Lower latency on the next call, but you must persist the expiry.</li>
<li><strong>Reactively</strong> \u2014 call the API normally, refresh on the first <code>401 token_expired</code>, and retry once.</li>
</ol>
<p>Reactive is simpler and good enough for most apps. Proactive is worth it
for latency-sensitive paths.</p>
<div class="adh-mv-alert adh-mv-alert--warning">
<p class="adh-mv-alert-title">Warning</p>
<p>The refresh endpoint is single-use: each refresh returns a <strong>new</strong>
<code>refresh_token</code> and invalidates the previous one. Persist the new token
atomically before using it.</p>
</div>
<h2 id="request"><a href="#request">Request</a></h2>
<h3 id="curl"><a href="#curl">curl</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">curl</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> -X</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> POST</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> https://api.agenticdeveloperhub.com/api/auth/refresh</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> \\</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  -H</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> "Content-Type: application/json"</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> \\</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  -d</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> '{</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "grant_type": "refresh_token",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "refresh_token": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$REFRESH_TOKEN</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "client_id": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$ADH_CLIENT_ID</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "client_secret": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$ADH_CLIENT_SECRET</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'"</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">  }'</span></span></code></pre>
<h3 id="typescript"><a href="#typescript">TypeScript</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">async</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> function</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> refresh</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70">refreshToken</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">) {</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> res</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> await</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> fetch</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    'https://api.agenticdeveloperhub.com/api/auth/refresh'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">    {</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      method: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'POST'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      headers: { </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'Content-Type'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'application/json'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> },</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      body: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">JSON</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">stringify</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">({</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">        grant_type: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'refresh_token'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">        refresh_token: refreshToken,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">        client_id: process.env.</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">ADH_CLIENT_ID</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">!</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">        client_secret: process.env.</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">ADH_CLIENT_SECRET</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">!</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      }),</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">    },</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  );</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">  if</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> (</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">!</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">res.ok) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">throw</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> Error</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'refresh failed \u2014 user must re-authorize'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">);</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">  return</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> (</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> res.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">json</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">()) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">as</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> {</span></span>
<span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70">    access_token</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span>
<span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70">    refresh_token</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span>
<span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70">    expires_in</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> number</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  };</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">}</span></span></code></pre>
<h3 id="swift"><a href="#swift">Swift</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span>struct RefreshRequest: Encodable {</span></span>
<span><span>    let grant_type = "refresh_token"</span></span>
<span><span>    let refresh_token: String</span></span>
<span><span>    let client_id: String</span></span>
<span><span>    let client_secret: String</span></span>
<span><span>}</span></span>
<span><span>// POST /api/auth/refresh \u2014 same shape as exchange, see Step 3.</span></span></code></pre>
<h3 id="kotlin"><a href="#kotlin">Kotlin</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span>@Serializable</span></span>
<span><span>data class RefreshRequest(</span></span>
<span><span>    val grant_type: String = "refresh_token",</span></span>
<span><span>    val refresh_token: String,</span></span>
<span><span>    val client_id: String,</span></span>
<span><span>    val client_secret: String,</span></span>
<span><span>)</span></span>
<span><span>// POST /api/auth/refresh \u2014 same shape as exchange, see Step 3.</span></span></code></pre>
<h2 id="response"><a href="#response">Response</a></h2>
<p>Identical shape to <a href="/quickstart/oauth/token-exchange">Step 3</a>:</p>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">{</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "access_token"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"adh_eyJhbGciOi..."</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "refresh_token"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"adh_rt_NEW..."</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "expires_in"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">3600</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "token_type"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"Bearer"</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">}</span></span></code></pre>
<p><strong>Replace</strong> both stored tokens with the values from this response.</p>
<h2 id="when-refresh-fails"><a href="#when-refresh-fails">When refresh fails</a></h2>
<p>A <code>400 invalid_grant</code> from <code>/api/auth/refresh</code> means the refresh token is
no longer valid \u2014 either revoked, expired, or already used. There's no
silent recovery: send the user through the authorization flow again,
starting from <a href="/quickstart/oauth/authorize">Step 2</a>.</p>
<h2 id="revoking-tokens"><a href="#revoking-tokens">Revoking tokens</a></h2>
<p>To proactively log a user out (e.g., they uninstalled your app), POST the
refresh token to <code>/api/auth/revoke</code>:</p>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">curl</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> -X</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> POST</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> https://api.agenticdeveloperhub.com/api/auth/revoke</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> \\</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  -H</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> "Content-Type: application/json"</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> \\</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  -d</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> '{</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "token": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$REFRESH_TOKEN</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "client_id": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$ADH_CLIENT_ID</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "client_secret": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$ADH_CLIENT_SECRET</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'"</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">  }'</span></span></code></pre>
<h2 id="youre-done"><a href="#youre-done">You're done</a></h2>
<p>That's the full OAuth flow. Verify your integration end-to-end:</p>
<ol>
<li>Start the flow \u2192 user approves \u2192 you receive <code>code</code>.</li>
<li>Exchange <code>code</code> \u2192 you get tokens \u2192 call <code>/api/auth/me</code> to confirm.</li>
<li>Wait for expiry (or force one for testing) \u2192 refresh \u2192 call <code>/api/auth/me</code>
again with the new token.</li>
</ol>
<p>If you hit a snag, the <a href="https://api.agenticdeveloperhub.com">API reference</a>
has every endpoint's exact request/response schema.</p>`,
  "oauth-register-app": `<h1 id="1-register-your-app"><a href="#1-register-your-app">1. Register your app</a></h1>
<p>Before you can run the OAuth flow you need a registered application. The
app's <code>client_id</code> identifies you to the authorization server; its registered
<code>redirect_uri</code> is the only URL we'll send users back to after they approve.</p>
<h2 id="steps"><a href="#steps">Steps</a></h2>
<ol>
<li>Sign in at <a href="https://temporal.today">temporal.today</a>.</li>
<li>Open <strong>Settings \u2192 Developer \u2192 OAuth apps</strong>.</li>
<li>Click <strong>New OAuth app</strong> and fill in:
<ul>
<li><strong>Name</strong> \u2014 shown to users on the consent screen.</li>
<li><strong>Homepage URL</strong> \u2014 your product's marketing or app URL.</li>
<li><strong>Redirect URIs</strong> \u2014 every URL the authorization server may redirect to
after approval. Add one per environment (production, staging, local
development).</li>
</ul>
</li>
<li>After saving you'll see:
<ul>
<li><code>client_id</code> \u2014 public, safe to embed in your client.</li>
<li><code>client_secret</code> \u2014 keep server-side. <strong>Shown once</strong> \u2014 copy it to your
secret store immediately.</li>
</ul>
</li>
</ol>
<div class="adh-mv-alert adh-mv-alert--warning">
<p class="adh-mv-alert-title">Warning</p>
<p>If you lose the <code>client_secret</code>, you can rotate it from the same screen.
Rotation invalidates the previous secret immediately.</p>
</div>
<h2 id="local-development"><a href="#local-development">Local development</a></h2>
<p>Add <code>http://localhost:&#x3C;port>/callback</code> (whatever your local server uses) as
an allowed redirect URI. The authorization server allows <code>http://localhost</code>
URIs as a special case; HTTPS is required for every other host.</p>
<h2 id="scopes"><a href="#scopes">Scopes</a></h2>
<p>When you initiate the authorization request, you'll ask for one or more
<strong>scopes</strong>. Request the narrowest set of scopes your app actually needs.</p>
<p>Common scopes (full catalogue lives on the consent screen):</p>
<table>
<thead>
<tr>
<th>Scope</th>
<th>What it grants</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>profile:read</code></td>
<td>Read the authenticated user's profile</td>
</tr>
<tr>
<td><code>discussions:read</code></td>
<td>Read forum threads / replies / DMs</td>
</tr>
<tr>
<td><code>discussions:write</code></td>
<td>Post replies, react, send DMs</td>
</tr>
<tr>
<td><code>integrations:manage</code></td>
<td>Connect third-party providers</td>
</tr>
</tbody>
</table>
<div class="adh-mv-alert adh-mv-alert--note">
<p class="adh-mv-alert-title">Note</p>
<p>The exact scope list is still evolving \u2014 confirm against the consent screen
shown during <a href="/quickstart/oauth/authorize">Step 2</a> when you build your
integration.</p>
</div>
<h2 id="next"><a href="#next">Next</a></h2>
<p>You've got a <code>client_id</code> and a <code>client_secret</code>.
\u2192 <a href="/quickstart/oauth/authorize">Step 2: Send the user to authorize</a></p>`,
  "oauth-token-exchange": `<h1 id="3-exchange-the-code-for-tokens"><a href="#3-exchange-the-code-for-tokens">3. Exchange the code for tokens</a></h1>
<p>You have an authorization <code>code</code> and a PKCE <code>verifier</code> from
<a href="/quickstart/oauth/authorize">Step 2</a>. Exchange them for an access token and
refresh token by POSTing to <code>/api/oauth/signin/exchange</code>.</p>
<div class="adh-mv-alert adh-mv-alert--warning">
<p class="adh-mv-alert-title">Warning</p>
<p>This call must happen on your <strong>server</strong>, not in the user's browser. The
<code>client_secret</code> is included in the request and must never leak to the
client.</p>
</div>
<h2 id="request"><a href="#request">Request</a></h2>
<h3 id="curl"><a href="#curl">curl</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">curl</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> -X</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> POST</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> https://api.agenticdeveloperhub.com/api/oauth/signin/exchange</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> \\</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  -H</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> "Content-Type: application/json"</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> \\</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  -d</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> '{</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "grant_type": "authorization_code",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "code": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$AUTH_CODE</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "redirect_uri": "https://your.app/callback",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "client_id": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$ADH_CLIENT_ID</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "client_secret": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$ADH_CLIENT_SECRET</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'",</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    "code_verifier": "'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$PKCE_VERIFIER</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'"</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">  }'</span></span></code></pre>
<h3 id="typescript"><a href="#typescript">TypeScript</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> res</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> await</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> fetch</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span></span>
<span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">  'https://api.agenticdeveloperhub.com/api/oauth/signin/exchange'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  {</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">    method: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'POST'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">    headers: { </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'Content-Type'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'application/json'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> },</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">    body: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">JSON</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">stringify</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">({</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      grant_type: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'authorization_code'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      code,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      redirect_uri: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'https://your.app/callback'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      client_id: process.env.</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">ADH_CLIENT_ID</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">!</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      client_secret: process.env.</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">ADH_CLIENT_SECRET</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">!</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">      code_verifier: verifier,</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">    }),</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  },</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">);</span></span>
<span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> tokens</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> (</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> res.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">json</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">()) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">as</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> {</span></span>
<span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70">  access_token</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span>
<span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70">  refresh_token</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span>
<span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70">  expires_in</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> number</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span>
<span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70">  token_type</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> 'Bearer'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">};</span></span></code></pre>
<h3 id="swift"><a href="#swift">Swift</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span>struct ExchangeRequest: Encodable {</span></span>
<span><span>    let grant_type = "authorization_code"</span></span>
<span><span>    let code: String</span></span>
<span><span>    let redirect_uri: String</span></span>
<span><span>    let client_id: String</span></span>
<span><span>    let client_secret: String</span></span>
<span><span>    let code_verifier: String</span></span>
<span><span>}</span></span>
<span><span>struct TokenResponse: Decodable {</span></span>
<span><span>    let access_token: String</span></span>
<span><span>    let refresh_token: String</span></span>
<span><span>    let expires_in: Int</span></span>
<span><span>    let token_type: String</span></span>
<span><span>}</span></span>
<span><span></span></span>
<span><span>let payload = ExchangeRequest(</span></span>
<span><span>    code: code,</span></span>
<span><span>    redirect_uri: "myapp://oauth/callback",</span></span>
<span><span>    client_id: "your-client-id",</span></span>
<span><span>    client_secret: "your-client-secret",</span></span>
<span><span>    code_verifier: codeVerifier</span></span>
<span><span>)</span></span>
<span><span>var req = URLRequest(url: URL(string: "https://api.agenticdeveloperhub.com/api/oauth/signin/exchange")!)</span></span>
<span><span>req.httpMethod = "POST"</span></span>
<span><span>req.setValue("application/json", forHTTPHeaderField: "Content-Type")</span></span>
<span><span>req.httpBody = try JSONEncoder().encode(payload)</span></span>
<span><span>let (data, _) = try await URLSession.shared.data(for: req)</span></span>
<span><span>let tokens = try JSONDecoder().decode(TokenResponse.self, from: data)</span></span></code></pre>
<h3 id="kotlin"><a href="#kotlin">Kotlin</a></h3>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span>@Serializable</span></span>
<span><span>data class ExchangeRequest(</span></span>
<span><span>    val grant_type: String = "authorization_code",</span></span>
<span><span>    val code: String,</span></span>
<span><span>    val redirect_uri: String,</span></span>
<span><span>    val client_id: String,</span></span>
<span><span>    val client_secret: String,</span></span>
<span><span>    val code_verifier: String,</span></span>
<span><span>)</span></span>
<span><span>@Serializable</span></span>
<span><span>data class TokenResponse(</span></span>
<span><span>    val access_token: String,</span></span>
<span><span>    val refresh_token: String,</span></span>
<span><span>    val expires_in: Int,</span></span>
<span><span>    val token_type: String,</span></span>
<span><span>)</span></span>
<span><span></span></span>
<span><span>val request = ExchangeRequest(</span></span>
<span><span>    code = code,</span></span>
<span><span>    redirect_uri = "https://your.app/callback",</span></span>
<span><span>    client_id = "your-client-id",</span></span>
<span><span>    client_secret = "your-client-secret",</span></span>
<span><span>    code_verifier = codeVerifier,</span></span>
<span><span>)</span></span>
<span><span>val tokens: TokenResponse = client.post("https://api.agenticdeveloperhub.com/api/oauth/signin/exchange") {</span></span>
<span><span>    contentType(ContentType.Application.Json)</span></span>
<span><span>    setBody(request)</span></span>
<span><span>}.body()</span></span></code></pre>
<h2 id="response"><a href="#response">Response</a></h2>
<p>A successful exchange returns:</p>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">{</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "access_token"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"adh_eyJhbGciOi..."</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "refresh_token"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"adh_rt_8f1a2..."</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "expires_in"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">3600</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "token_type"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"Bearer"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  "scope"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"profile:read discussions:read"</span></span>
<span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">}</span></span></code></pre>
<ul>
<li><code>access_token</code> \u2014 use as <code>Authorization: Bearer &#x3C;token></code> on every API
request. Treat as sensitive; do not log it.</li>
<li><code>refresh_token</code> \u2014 store <strong>server-side, encrypted</strong>. Used to get a new
access token without re-prompting the user.</li>
<li><code>expires_in</code> \u2014 seconds until the access token expires (typically one
hour). Refresh <strong>before</strong> it expires to avoid races.</li>
</ul>
<h2 id="errors"><a href="#errors">Errors</a></h2>
<table>
<thead>
<tr>
<th>HTTP</th>
<th><code>error</code></th>
<th>Cause</th>
</tr>
</thead>
<tbody>
<tr>
<td>400</td>
<td><code>invalid_grant</code></td>
<td>Code already used, expired (60s TTL), or wrong <code>redirect_uri</code></td>
</tr>
<tr>
<td>400</td>
<td><code>invalid_request</code></td>
<td>Missing or malformed parameter</td>
</tr>
<tr>
<td>401</td>
<td><code>invalid_client</code></td>
<td>Wrong <code>client_id</code> / <code>client_secret</code></td>
</tr>
<tr>
<td>401</td>
<td><code>invalid_verifier</code></td>
<td>PKCE <code>code_verifier</code> doesn't match the original challenge</td>
</tr>
</tbody>
</table>
<p>See <a href="/reference/errors">Errors</a> for the response body shape.</p>
<h2 id="use-the-access-token"><a href="#use-the-access-token">Use the access token</a></h2>
<pre style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e"><code><span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">curl</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> https://api.agenticdeveloperhub.com/api/auth/me</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> \\</span></span>
<span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">  -H</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> "Authorization: Bearer </span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">$ACCESS_TOKEN</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"</span></span></code></pre>
<h2 id="next"><a href="#next">Next</a></h2>
<p>\u2192 <a href="/quickstart/oauth/refresh">Step 4: Refresh when the token expires</a></p>`,
  "webhooks": `<h1 id="webhooks"><a href="#webhooks">Webhooks</a></h1>
<div class="adh-mv-alert adh-mv-alert--note">
<p class="adh-mv-alert-title">Note</p>
<p>The public webhooks API is on the roadmap. The backend already serves
internal webhook receivers at <code>/api/webhooks/*</code> (Postmark, Stripe, etc.) \u2014
those are intentionally hidden from the public API reference because the
sender is the third party, not your application.</p>
</div>
<h2 id="what-will-be-available"><a href="#what-will-be-available">What will be available</a></h2>
<p>When the outbound webhooks ship, you'll be able to:</p>
<ul>
<li>Register webhook subscriptions per OAuth app (one or more URLs).</li>
<li>Filter events by type (e.g., <code>discussion.thread.created</code>,
<code>integration.connected</code>).</li>
<li>Verify deliveries with an HMAC signature in the
<code>X-AgenticDeveloperHub-Signature</code> header.</li>
<li>Replay recent deliveries from the dashboard.</li>
</ul>
<h2 id="until-then"><a href="#until-then">Until then</a></h2>
<p>If your use case needs realtime updates, the WebSocket endpoint at
<code>/ws/discussions</code> already broadcasts most user-facing events (replies,
reactions, notifications, DMs, presence). It is documented in the
description block of the <a href="https://api.agenticdeveloperhub.com">API reference</a>.</p>`
};

// src/docs/content.ts
function getDocHtmlByKey(key) {
  return HELP_CONTENT_HTML[key];
}

// src/help/topics.ts
var HELP_TOPICS = [
  {
    id: "chat",
    label: "Chat",
    slug: "chat",
    description: "Ask bitbag anything about building on the Agentic Developer Hub.",
    view: "chat"
  },
  {
    // Placeholder section: no guide content of its own (the old walkthrough was stale and was
    // removed) — selecting it opens OAuth beneath, so its landing is the children overview, exactly
    // like Reference. Give it a `contentKey` again when a real quickstart guide is written.
    id: "quickstart",
    label: "Quickstart",
    slug: "quickstart",
    description: "Register an app, get a token, and make your first call.",
    children: [
      {
        id: "oauth",
        label: "OAuth",
        slug: "quickstart/oauth",
        description: "Authorize on behalf of a user with the OAuth 2.0 flow.",
        children: [
          { id: "oauth-overview", label: "Overview", slug: "quickstart/oauth/overview", description: "How the flow fits together.", contentKey: "oauth-overview" },
          { id: "oauth-register-app", label: "Register app", slug: "quickstart/oauth/register-app", description: "Create OAuth credentials.", contentKey: "oauth-register-app" },
          { id: "oauth-authorize", label: "Authorize", slug: "quickstart/oauth/authorize", description: "Send the user to consent.", contentKey: "oauth-authorize" },
          { id: "oauth-token-exchange", label: "Token exchange", slug: "quickstart/oauth/token-exchange", description: "Trade the code for tokens.", contentKey: "oauth-token-exchange" },
          { id: "oauth-refresh", label: "Refresh", slug: "quickstart/oauth/refresh", description: "Keep the session alive.", contentKey: "oauth-refresh" }
        ]
      }
    ]
  },
  {
    id: "reference",
    label: "Reference",
    slug: "reference",
    description: "Error codes, webhooks, and what changed.",
    children: [
      { id: "errors", label: "Errors", slug: "reference/errors", description: "Error codes and what they mean.", contentKey: "errors" },
      { id: "webhooks", label: "Webhooks", slug: "reference/webhooks", description: "Events the hub can push to you.", contentKey: "webhooks" },
      { id: "changelog", label: "Changelog", slug: "reference/changelog", description: "Recent API changes.", contentKey: "changelog" }
    ]
  },
  {
    id: "rest-api",
    label: "REST API",
    slug: "rest-api",
    description: "Browse every REST endpoint and try calls against your session.",
    view: "api"
  },
  {
    // A section, not a monolithic page: the old single mcp.md split into per-concern child topics,
    // so /mcp lands on the children overview exactly like Quickstart and Reference.
    id: "mcp",
    label: "MCP",
    slug: "mcp",
    description: "Connect an agent to the hub over the Model Context Protocol.",
    children: [
      { id: "mcp-overview", label: "Overview", slug: "mcp/overview", description: "What the MCP server is, and how it relates to the REST API.", contentKey: "mcp-overview" },
      { id: "mcp-connect", label: "Connect a client", slug: "mcp/connect", description: "Point Claude Desktop, Claude Code, Cursor, or the Inspector at the server.", contentKey: "mcp-connect" },
      { id: "mcp-tools", label: "Tools", slug: "mcp/tools", description: "Every tool the server exposes, grouped by area.", contentKey: "mcp-tools" },
      { id: "mcp-details", label: "Details", slug: "mcp/details", description: "Transport, auth, session, and data-scope facts.", contentKey: "mcp-details" }
    ]
  },
  {
    // Same split as MCP: the old hub-features.md's H2 sections are now child topics, one per
    // feature area, so /hub lands on the children overview cards.
    id: "hub",
    label: "Hub Features",
    slug: "hub",
    description: "What you can do across the Agentic Developer Hub.",
    children: [
      { id: "hub-overview", label: "Overview", slug: "hub/overview", description: "How workspaces scope everything you do in the Hub.", contentKey: "hub-overview" },
      { id: "hub-workspaces", label: "Workspaces & account", slug: "hub/workspaces", description: "Workspaces, settings, members, and API tokens.", contentKey: "hub-workspaces" },
      { id: "hub-personas", label: "Personas", slug: "hub/personas", description: "Design, register, and run AI personas.", contentKey: "hub-personas" },
      { id: "hub-products", label: "Products", slug: "hub/products", description: "Ecosystems: apps, tokens, customers, flags, and gamification.", contentKey: "hub-products" },
      { id: "hub-storage", label: "Storage & data", slug: "hub/storage", description: "Buckets, files, access, and data integrations.", contentKey: "hub-storage" },
      { id: "hub-plan", label: "Plan", slug: "hub/plan", description: "Projects, narratives, and research.", contentKey: "hub-plan" },
      { id: "hub-teams", label: "Teams", slug: "hub/teams", description: "Member teams, the team registry, and the team builder.", contentKey: "hub-teams" },
      { id: "hub-community", label: "Community & support", slug: "hub/community", description: "Discussions, support, news, and messaging.", contentKey: "hub-community" },
      { id: "hub-monitoring", label: "Monitoring", slug: "hub/monitoring", description: "Dashboards that watch your sites and endpoints.", contentKey: "hub-monitoring" },
      { id: "hub-apis", label: "APIs & agents", slug: "hub/apis", description: "The REST API, MCP, OAuth, and reusable tools.", contentKey: "hub-apis" }
    ]
  }
];
function isLeaf(topic) {
  return !topic.children || topic.children.length === 0;
}
function hasDetail(topic) {
  return topic.contentKey != null || topic.view != null;
}
function findTopicPath(id, topics = HELP_TOPICS) {
  for (const topic of topics) {
    if (topic.id === id) return [topic];
    if (topic.children) {
      const deeper = findTopicPath(id, topic.children);
      if (deeper) return [topic, ...deeper];
    }
  }
  return null;
}
function flattenTopics(topics = HELP_TOPICS) {
  return topics.flatMap((t) => [t, ...t.children ? flattenTopics(t.children) : []]);
}
function helpSlugs() {
  return flattenTopics().map((t) => t.slug);
}
function topicBySlug(slug) {
  return flattenTopics().find((t) => t.slug === slug);
}
function topicPathForSlug(slug) {
  const topic = topicBySlug(slug);
  if (!topic) return null;
  const path = findTopicPath(topic.id);
  return path ? path.map((t) => t.id) : null;
}
function buildTopicLevels(path) {
  const levels = [];
  let siblings = HELP_TOPICS;
  let title = "Help";
  let parentId = null;
  let activeTopic = null;
  for (let depth = 0; ; depth++) {
    const selId = path[depth] ?? null;
    levels.push({
      parentId,
      title,
      items: siblings.map((t) => ({ id: t.id, label: t.label, description: t.description, slug: t.slug })),
      selectedId: selId
    });
    if (selId == null) break;
    const node = siblings.find((t) => t.id === selId) ?? null;
    if (!node) break;
    activeTopic = node;
    if (node.children && node.children.length > 0) {
      siblings = node.children;
      title = node.label;
      parentId = node.id;
      continue;
    }
    break;
  }
  return { levels, activeTopic };
}

// src/help/HelpSurface.tsx
import { HelpMasterDetail } from "@agentic-toolkit/adh/help/HelpMasterDetail";
import { jsx as jsx2 } from "react/jsx-runtime";
function helpHref(basePath, slug) {
  const base = basePath === "/" ? "" : basePath;
  return slug === "" ? base || "/" : `${base}/${slug}`;
}
function renderLeaf(topic, chatSlot) {
  if (!topic) {
    return /* @__PURE__ */ jsx2(EmptyState, { className: "m-4", title: "Help", description: "Choose a topic to get started." });
  }
  if (topic.view === "chat") {
    return /* @__PURE__ */ jsx2("div", { className: "adh-help-topic adh-help-topic--chat", children: chatSlot });
  }
  if (!topic.contentKey) {
    return /* @__PURE__ */ jsx2(
      EmptyState,
      {
        className: "m-4",
        title: topic.label,
        description: topic.description ?? "Choose a subtopic."
      }
    );
  }
  const html = getDocHtmlByKey(topic.contentKey);
  return /* @__PURE__ */ jsx2("div", { className: "adh-help-topic adh-help-topic--markdown", children: html == null ? /* @__PURE__ */ jsx2("p", { className: "adh-help-topic__missing", children: "This topic has no content yet." }) : /* @__PURE__ */ jsx2(MarkdownHtml, { html }) });
}
function HelpSurface({
  slug,
  basePath = "",
  chatSlot,
  rootClearHref
}) {
  const path = topicPathForSlug(slug) ?? [];
  const { levels, activeTopic } = buildTopicLevels(path);
  const pathTopics = activeTopic ? findTopicPath(activeTopic.id) ?? [] : [];
  const routeLevels = levels.map((level, depth) => ({
    key: level.parentId == null ? "help-root" : `help:${level.parentId}`,
    title: level.title,
    items: level.items.map((it) => ({
      id: it.id,
      label: it.label,
      description: it.description,
      href: helpHref(basePath, it.slug)
    })),
    selectedId: level.selectedId,
    // Level 0 clears to the surface's home (`rootClearHref`, defaulting to the apex); a nested
    // level clears up to its parent section's route (the topic one step up the active path).
    clearHref: depth === 0 ? rootClearHref ?? helpHref(basePath, "") : helpHref(basePath, pathTopics[depth - 1]?.slug ?? "")
  }));
  return /* @__PURE__ */ jsx2(HelpMasterDetail, { levels: routeLevels, rootLabel: "Help", children: renderLeaf(activeTopic, chatSlot) });
}

// src/help/topic-icons.tsx
import {
  AppWindow,
  ArrowLeftRight,
  Bot,
  Braces,
  FileText,
  Handshake,
  History,
  LayoutGrid,
  Library,
  Plug,
  RefreshCw,
  Rocket,
  Route,
  TriangleAlert,
  UserCheck,
  Webhook
} from "lucide-react";
import { jsx as jsx3 } from "react/jsx-runtime";
var TOPIC_ICON = {
  chat: /* @__PURE__ */ jsx3(Bot, { size: 16, "aria-hidden": true }),
  quickstart: /* @__PURE__ */ jsx3(Rocket, { size: 16, "aria-hidden": true }),
  oauth: /* @__PURE__ */ jsx3(Handshake, { size: 16, "aria-hidden": true }),
  "oauth-overview": /* @__PURE__ */ jsx3(Route, { size: 16, "aria-hidden": true }),
  "oauth-register-app": /* @__PURE__ */ jsx3(AppWindow, { size: 16, "aria-hidden": true }),
  "oauth-authorize": /* @__PURE__ */ jsx3(UserCheck, { size: 16, "aria-hidden": true }),
  "oauth-token-exchange": /* @__PURE__ */ jsx3(ArrowLeftRight, { size: 16, "aria-hidden": true }),
  "oauth-refresh": /* @__PURE__ */ jsx3(RefreshCw, { size: 16, "aria-hidden": true }),
  reference: /* @__PURE__ */ jsx3(Library, { size: 16, "aria-hidden": true }),
  errors: /* @__PURE__ */ jsx3(TriangleAlert, { size: 16, "aria-hidden": true }),
  webhooks: /* @__PURE__ */ jsx3(Webhook, { size: 16, "aria-hidden": true }),
  changelog: /* @__PURE__ */ jsx3(History, { size: 16, "aria-hidden": true }),
  "rest-api": /* @__PURE__ */ jsx3(Braces, { size: 16, "aria-hidden": true }),
  mcp: /* @__PURE__ */ jsx3(Plug, { size: 16, "aria-hidden": true }),
  hub: /* @__PURE__ */ jsx3(LayoutGrid, { size: 16, "aria-hidden": true })
};
function topicIcon(id) {
  return TOPIC_ICON[id] ?? /* @__PURE__ */ jsx3(FileText, { size: 16, "aria-hidden": true });
}
export {
  HELP_TOPICS,
  HelpSurface,
  buildTopicLevels,
  findTopicPath,
  flattenTopics,
  hasDetail,
  helpHref,
  helpSlugs,
  isLeaf,
  topicBySlug,
  topicIcon,
  topicPathForSlug
};
//# sourceMappingURL=surface.js.map