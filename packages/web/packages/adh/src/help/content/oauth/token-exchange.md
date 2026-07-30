# 3. Exchange the code for tokens

You have an authorization `code` and a PKCE `verifier` from
[Step 2](/quickstart/oauth/authorize). Exchange them for an access token and
refresh token by POSTing to `/api/oauth/signin/exchange`.

> [!WARNING]
> This call must happen on your **server**, not in the user's browser. The
> `client_secret` is included in the request and must never leak to the
> client.

## Request

### curl

```bash
curl -X POST https://api.agenticdeveloperhub.com/api/oauth/signin/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "'$AUTH_CODE'",
    "redirect_uri": "https://your.app/callback",
    "client_id": "'$ADH_CLIENT_ID'",
    "client_secret": "'$ADH_CLIENT_SECRET'",
    "code_verifier": "'$PKCE_VERIFIER'"
  }'
```

### TypeScript

```ts
const res = await fetch(
  'https://api.agenticdeveloperhub.com/api/oauth/signin/exchange',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://your.app/callback',
      client_id: process.env.ADH_CLIENT_ID!,
      client_secret: process.env.ADH_CLIENT_SECRET!,
      code_verifier: verifier,
    }),
  },
);
const tokens = (await res.json()) as {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
};
```

### Swift

```swift
struct ExchangeRequest: Encodable {
    let grant_type = "authorization_code"
    let code: String
    let redirect_uri: String
    let client_id: String
    let client_secret: String
    let code_verifier: String
}
struct TokenResponse: Decodable {
    let access_token: String
    let refresh_token: String
    let expires_in: Int
    let token_type: String
}

let payload = ExchangeRequest(
    code: code,
    redirect_uri: "myapp://oauth/callback",
    client_id: "your-client-id",
    client_secret: "your-client-secret",
    code_verifier: codeVerifier
)
var req = URLRequest(url: URL(string: "https://api.agenticdeveloperhub.com/api/oauth/signin/exchange")!)
req.httpMethod = "POST"
req.setValue("application/json", forHTTPHeaderField: "Content-Type")
req.httpBody = try JSONEncoder().encode(payload)
let (data, _) = try await URLSession.shared.data(for: req)
let tokens = try JSONDecoder().decode(TokenResponse.self, from: data)
```

### Kotlin

```kotlin
@Serializable
data class ExchangeRequest(
    val grant_type: String = "authorization_code",
    val code: String,
    val redirect_uri: String,
    val client_id: String,
    val client_secret: String,
    val code_verifier: String,
)
@Serializable
data class TokenResponse(
    val access_token: String,
    val refresh_token: String,
    val expires_in: Int,
    val token_type: String,
)

val request = ExchangeRequest(
    code = code,
    redirect_uri = "https://your.app/callback",
    client_id = "your-client-id",
    client_secret = "your-client-secret",
    code_verifier = codeVerifier,
)
val tokens: TokenResponse = client.post("https://api.agenticdeveloperhub.com/api/oauth/signin/exchange") {
    contentType(ContentType.Application.Json)
    setBody(request)
}.body()
```

## Response

A successful exchange returns:

```json
{
  "access_token": "adh_eyJhbGciOi...",
  "refresh_token": "adh_rt_8f1a2...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "profile:read discussions:read"
}
```

- `access_token` — use as `Authorization: Bearer <token>` on every API
  request. Treat as sensitive; do not log it.
- `refresh_token` — store **server-side, encrypted**. Used to get a new
  access token without re-prompting the user.
- `expires_in` — seconds until the access token expires (typically one
  hour). Refresh **before** it expires to avoid races.

## Errors

| HTTP | `error`              | Cause                                            |
| ---- | -------------------- | ------------------------------------------------ |
| 400  | `invalid_grant`      | Code already used, expired (60s TTL), or wrong `redirect_uri` |
| 400  | `invalid_request`    | Missing or malformed parameter                    |
| 401  | `invalid_client`     | Wrong `client_id` / `client_secret`               |
| 401  | `invalid_verifier`   | PKCE `code_verifier` doesn't match the original challenge |

See [Errors](/reference/errors) for the response body shape.

## Use the access token

```bash
curl https://api.agenticdeveloperhub.com/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Next

→ [Step 4: Refresh when the token expires](/quickstart/oauth/refresh)
