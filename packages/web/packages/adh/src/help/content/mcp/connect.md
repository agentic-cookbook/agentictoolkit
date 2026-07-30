# Connect your client

> [!NOTE]
> Mint an API token first: `POST /auth/tokens` with your JWT (or via the web
> app's API-tokens screen). The raw value is shown **once**.

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows). Restart Claude
Desktop.

```json
{
  "mcpServers": {
    "agentic-developer-hub": {
      "type": "streamable-http",
      "url": "https://mcp.agenticdeveloperhub.com/mcp",
      "headers": {
        "Authorization": "Bearer <paste-token>"
      }
    }
  }
}
```

## Claude Code

From the command line:

```bash
claude mcp add --transport http agentic-developer-hub \
  https://mcp.agenticdeveloperhub.com/mcp \
  --header "Authorization: Bearer <paste-token>"
```

## Cursor

Edit `~/.cursor/mcp.json` (or Cursor Settings → MCP). Restart Cursor.

```json
{
  "mcpServers": {
    "agentic-developer-hub": {
      "url": "https://mcp.agenticdeveloperhub.com/mcp",
      "headers": {
        "Authorization": "Bearer <paste-token>"
      }
    }
  }
}
```

## MCP Inspector

For debugging — a web UI that lets you call tools by hand:

```bash
npx -y @modelcontextprotocol/inspector
```

Then connect with transport `streamable-http`, URL
`https://mcp.agenticdeveloperhub.com/mcp`, and an `Authorization: Bearer …`
header.
