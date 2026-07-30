# 1. Register your app

Before you can run the OAuth flow you need a registered application. The
app's `client_id` identifies you to the authorization server; its registered
`redirect_uri` is the only URL we'll send users back to after they approve.

## Steps

1. Sign in at [temporal.today](https://temporal.today).
2. Open **Settings → Developer → OAuth apps**.
3. Click **New OAuth app** and fill in:
   - **Name** — shown to users on the consent screen.
   - **Homepage URL** — your product's marketing or app URL.
   - **Redirect URIs** — every URL the authorization server may redirect to
     after approval. Add one per environment (production, staging, local
     development).
4. After saving you'll see:
   - `client_id` — public, safe to embed in your client.
   - `client_secret` — keep server-side. **Shown once** — copy it to your
     secret store immediately.

> [!WARNING]
> If you lose the `client_secret`, you can rotate it from the same screen.
> Rotation invalidates the previous secret immediately.

## Local development

Add `http://localhost:<port>/callback` (whatever your local server uses) as
an allowed redirect URI. The authorization server allows `http://localhost`
URIs as a special case; HTTPS is required for every other host.

## Scopes

When you initiate the authorization request, you'll ask for one or more
**scopes**. Request the narrowest set of scopes your app actually needs.

Common scopes (full catalogue lives on the consent screen):

| Scope             | What it grants                         |
| ----------------- | -------------------------------------- |
| `profile:read`    | Read the authenticated user's profile  |
| `discussions:read`| Read forum threads / replies / DMs     |
| `discussions:write`| Post replies, react, send DMs         |
| `integrations:manage`| Connect third-party providers       |

> [!NOTE]
> The exact scope list is still evolving — confirm against the consent screen
> shown during [Step 2](/quickstart/oauth/authorize) when you build your
> integration.

## Next

You've got a `client_id` and a `client_secret`.
→ [Step 2: Send the user to authorize](/quickstart/oauth/authorize)
