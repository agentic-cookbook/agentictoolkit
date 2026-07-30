# 2. Send the user to authorize

In this step your app redirects the user to the Agentic Developer Hub
authorization endpoint. The user signs in, sees a consent screen listing the
scopes you requested, and clicks **Approve**. We send them back to your
`redirect_uri` with a one-time `code` you'll exchange for tokens in
[Step 3](/quickstart/oauth/token-exchange).

## Generate a PKCE pair

PKCE protects against intercepted authorization codes. Generate a
**verifier** (random string you keep) and a **challenge** (SHA-256 of the
verifier, base64url-encoded) for every authorization request.

### TypeScript

```ts
function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function generatePKCE() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64url(bytes.buffer);
  const challenge = base64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  );
  return { verifier, challenge };
}
```

### Swift

```swift
import CryptoKit

extension Data {
    func base64URLEncoded() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

func generatePKCE() -> (verifier: String, challenge: String) {
    var bytes = [UInt8](repeating: 0, count: 32)
    _ = SecRandomCopyBytes(kSecRandomDefault, 32, &bytes)
    let verifier = Data(bytes).base64URLEncoded()
    let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncoded()
    return (verifier, challenge)
}
```

### Kotlin

```kotlin
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

fun generatePKCE(): Pair<String, String> {
    val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
    val verifier = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(
        MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray())
    )
    return verifier to challenge
}
```

Store the `verifier` in the user's session — you'll need it for the token
exchange.

## Redirect the user

Build a URL with the `client_id`, the `redirect_uri`, the requested
`scope`s, a `state` parameter (random, anti-CSRF), and the PKCE
`code_challenge`.

### curl

```bash
open "https://api.agenticdeveloperhub.com/api/oauth/signin/start\
?client_id=$ADH_CLIENT_ID\
&redirect_uri=https%3A%2F%2Fyour.app%2Fcallback\
&response_type=code\
&scope=profile%3Aread%20discussions%3Aread\
&state=$RANDOM_STATE\
&code_challenge=$PKCE_CHALLENGE\
&code_challenge_method=S256"
```

### TypeScript

```ts
const url = new URL('https://api.agenticdeveloperhub.com/api/oauth/signin/start');
url.searchParams.set('client_id', clientId);
url.searchParams.set('redirect_uri', 'https://your.app/callback');
url.searchParams.set('response_type', 'code');
url.searchParams.set('scope', 'profile:read discussions:read');
url.searchParams.set('state', state);
url.searchParams.set('code_challenge', challenge);
url.searchParams.set('code_challenge_method', 'S256');

window.location.href = url.toString();
```

> [!WARNING]
> The `state` parameter prevents CSRF attacks on the redirect. Generate a
> fresh random string per request, store it in the user's session, and
> **reject** the callback if the returned `state` doesn't match.

## Handle the redirect

After the user approves, we send them back to your `redirect_uri` with
`?code=…&state=…` query parameters.

```text
https://your.app/callback?code=AUTH_CODE_HERE&state=SAME_STATE
```

Verify the `state` matches what you stored, then exchange the `code` for
tokens in the next step.

## Next

→ [Step 3: Exchange the code for tokens](/quickstart/oauth/token-exchange)
