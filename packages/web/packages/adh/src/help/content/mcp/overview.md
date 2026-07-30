# MCP Server

A Model Context Protocol endpoint. Your AI agent connects here over Streamable
HTTP and gets a curated set of tools to call against your authenticated data.

```http
POST https://mcp.agenticdeveloperhub.com/mcp
```

## What this is

MCP is a protocol for AI agents to discover and call tools on a server. It's a
sibling of the REST API, not a replacement.

### MCP — this server

- For LLM agents, not browsers
- Single endpoint (`POST /mcp`)
- JSON-RPC over HTTP
- Tool discovery built in (`tools/list`)
- Auth: `Authorization: Bearer <api-token>`

### REST API

- For humans and traditional clients
- Resource-oriented (`/…`)
- OpenAPI 3.1 spec — see the [API reference](/rest-api)
- Auth: JWT (email/password or OAuth)
