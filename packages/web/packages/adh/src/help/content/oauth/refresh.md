# 4. Refresh when the token expires

Access tokens expire after `expires_in` seconds (typically one hour). Use
the `refresh_token` from [Step 3](/quickstart/oauth/token-exchange) to get a new
access token **without** redirecting the user again.

## When to refresh

Pick **one** strategy and stick to it:

1. **Proactively** — schedule a refresh ~60 seconds before `expires_in`.
   Lower latency on the next call, but you must persist the expiry.
2. **Reactively** — call the API normally, refresh on the first `401
   token_expired`, and retry once.

Reactive is simpler and good enough for most apps. Proactive is worth it
for latency-sensitive paths.

> [!WARNING]
> The refresh endpoint is single-use: each refresh returns a **new**
> `refresh_token` and invalidates the previous one. Persist the new token
> atomically before using it.

## Request

### curl

```bash
curl -X POST https://api.agenticdeveloperhub.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "'$REFRESH_TOKEN'",
    "client_id": "'$ADH_CLIENT_ID'",
    "client_secret": "'$ADH_CLIENT_SECRET'"
  }'
```

### TypeScript

```ts
async function refresh(refreshToken: string) {
  const res = await fetch(
    'https://api.agenticdeveloperhub.com/api/auth/refresh',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.ADH_CLIENT_ID!,
        client_secret: process.env.ADH_CLIENT_SECRET!,
      }),
    },
  );
  if (!res.ok) throw new Error('refresh failed — user must re-authorize');
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
```

### Swift

```swift
struct RefreshRequest: Encodable {
    let grant_type = "refresh_token"
    let refresh_token: String
    let client_id: String
    let client_secret: String
}
// POST /api/auth/refresh — same shape as exchange, see Step 3.
```

### Kotlin

```kotlin
@Serializable
data class RefreshRequest(
    val grant_type: String = "refresh_token",
    val refresh_token: String,
    val client_id: String,
    val client_secret: String,
)
// POST /api/auth/refresh — same shape as exchange, see Step 3.
```

## Response

Identical shape to [Step 3](/quickstart/oauth/token-exchange):

```json
{
  "access_token": "adh_eyJhbGciOi...",
  "refresh_token": "adh_rt_NEW...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Replace** both stored tokens with the values from this response.

## When refresh fails

A `400 invalid_grant` from `/api/auth/refresh` means the refresh token is
no longer valid — either revoked, expired, or already used. There's no
silent recovery: send the user through the authorization flow again,
starting from [Step 2](/quickstart/oauth/authorize).

## Revoking tokens

To proactively log a user out (e.g., they uninstalled your app), POST the
refresh token to `/api/auth/revoke`:

```bash
curl -X POST https://api.agenticdeveloperhub.com/api/auth/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$REFRESH_TOKEN'",
    "client_id": "'$ADH_CLIENT_ID'",
    "client_secret": "'$ADH_CLIENT_SECRET'"
  }'
```

## You're done

That's the full OAuth flow. Verify your integration end-to-end:

1. Start the flow → user approves → you receive `code`.
2. Exchange `code` → you get tokens → call `/api/auth/me` to confirm.
3. Wait for expiry (or force one for testing) → refresh → call `/api/auth/me`
   again with the new token.

If you hit a snag, the [API reference](https://api.agenticdeveloperhub.com)
has every endpoint's exact request/response schema.
