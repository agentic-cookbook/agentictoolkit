// Integrations API client — wired to the real backend integrations subsystem
// (/api/integrations). Covers two surfaces:
//   • the provider CATALOG (GET /integrations/providers) — every provider the
//     platform can integrate, with its auth method + capabilities; and
//   • an ecosystem's own, owner-scoped provider CONFIGS — its OAuth client
//     credentials + optional endpoint overrides, secrets masked to `hasSecret`.
//
// `ecosystemId` == the ecosystem id (the RLS owner). The backend 403s if it isn't
// the caller's own ecosystem; that surfaces as a thrown AuthHttpError the pane
// renders inline (it never crashes).
//
// It also covers an ecosystem's CONNECTIONS (linked accounts): list / connect
// (all five auth methods) / disconnect / sync-now / per-connection sync settings,
// plus the OAuth start endpoints (auth-url, register-instance, link-token). Every
// call names the target ecosystem (list/auth-url/link-token/register-instance take
// `ecosystemId`; connect names it in `ecosystemId`); the backend authorizes the caller
// against that ecosystem (403 otherwise). Connection-scoped ops (disconnect / sync /
// settings) derive the ecosystem from the connection, so they take only its id.

import { authedJson, authedRequest, isNotFound } from "../http";
import { enc } from "../client-helpers";
import type {
  AuthUrlResultRow,
  ConnectRequestBody,
  CreateProviderConfigBody,
  DeliverabilityWebhookRow,
  LinkTokenBodyType,
  MaskedProviderConfigRow,
  ProviderCatalogEntryRow,
  ProviderConfigInputBody,
  RegisterInstanceBodyType,
  RegisterInstanceResultRow,
  SafeConnectionRow,
  SyncSettingsBodyType,
  SyncSettingsResultRow,
} from "./wire";

/** A provider catalog entry (from GET /integrations/providers). */
export type ProviderCatalogEntry = ProviderCatalogEntryRow;

/** The provider auth methods that gate the config editor's field set. */
export type ProviderAuthMethod = ProviderCatalogEntry["authMethod"];

/** A stored, secret-masked provider config for an ecosystem. */
export type MaskedProviderConfig = MaskedProviderConfigRow;

/** The registration details for a provider's deliverability webhook (postmark today). */
export type DeliverabilityWebhook = DeliverabilityWebhookRow;

/** The PUT (upsert) body for a provider config — a blank/absent
 *  `clientSecret` preserves the stored secret. */
export type ProviderConfigInput = ProviderConfigInputBody;

/** The POST (create) body for a new provider config — names the target provider
 *  and a human-facing config name, plus the same input fields as the upsert body. */
export type CreateProviderConfig = CreateProviderConfigBody;

/** A caller's own connection (linked account), secrets redacted. */
export type SafeConnection = SafeConnectionRow;

/** The polymorphic connect body — a discriminated union keyed by `type`
 *  (= the provider's auth method). Every variant requires `ecosystemId`: the
 *  client names the target ecosystem, and the backend authorizes the caller
 *  against it (403 otherwise) before persisting the connection under it. */
export type ConnectRequest = ConnectRequestBody;

/** `{ url, state }` — the OAuth authorize URL + the round-trip CSRF state. */
export type AuthUrlResult = AuthUrlResultRow;

/** Body for register-instance (self-hosted OAuth, e.g. Mastodon). */
export type RegisterInstanceBody = RegisterInstanceBodyType;

/** `{ state, authorizeUrl, clientId }` from register-instance. */
export type RegisterInstanceResult = RegisterInstanceResultRow;

/** Optional body for the Plaid link-token mint (`{ serviceType? }`). */
export type LinkTokenBody = LinkTokenBodyType;

/** Per-connection sync settings the worker reads (gmail today). */
export type SyncSettingsBody = SyncSettingsBodyType;

/** `{ ok, syncSettings }` returned by the settings PATCH. */
export type SyncSettingsResult = SyncSettingsResultRow;

const BASE = "/api/integrations";

/** The client route the OAuth/oauth_instance provider redirects back to with the
 *  authorization `code`. Kept as one constant so the connect flow and the callback
 *  page agree on the path. The backend must allow this path for the hub's origins
 *  (see `redirectAllowlist.ts`). */
export const OAUTH_CALLBACK_PATH = "/integrations/oauth-callback";

/** The absolute callback URL for the current origin (client-only). */
export function oauthCallbackUrl(): string {
  return `${window.location.origin}${OAUTH_CALLBACK_PATH}`;
}

const configPath = (ecosystemId: string, providerId?: string) =>
  providerId
    ? `${BASE}/ecosystems/${enc(ecosystemId)}/provider-configs/${enc(providerId)}`
    : `${BASE}/ecosystems/${enc(ecosystemId)}/provider-configs`;

/** The id/rdid-addressed path for one provider config within an ecosystem. */
const configByIdPath = (ecosystemId: string, configId: string) =>
  `${BASE}/ecosystems/${enc(ecosystemId)}/provider-configs/${enc(configId)}`;

export const integrationsApi = {
  /** The provider catalog — every provider the platform can integrate. */
  async listProviders(): Promise<ProviderCatalogEntry[]> {
    const { providers } = await authedJson<{ providers: ProviderCatalogEntry[] }>(
      `${BASE}/providers`,
    );
    return providers;
  },

  /** The ecosystem's configured providers (secrets masked to `hasSecret`). */
  async listProviderConfigs(ecosystemId: string): Promise<MaskedProviderConfig[]> {
    const { configs } = await authedJson<{ configs: MaskedProviderConfig[] }>(
      configPath(ecosystemId),
    );
    return configs;
  },

  /** One masked config, or null when none is stored yet (backend 404). */
  async getProviderConfig(
    ecosystemId: string,
    providerId: string,
  ): Promise<MaskedProviderConfig | null> {
    try {
      return await authedJson<MaskedProviderConfig>(configPath(ecosystemId, providerId));
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  },

  /** Upsert the config. A blank/absent `clientSecret` in `body` preserves the
   *  stored secret; a present one replaces it. Returns the masked row. */
  async putProviderConfig(
    ecosystemId: string,
    providerId: string,
    body: ProviderConfigInput,
  ): Promise<MaskedProviderConfig> {
    return authedJson<MaskedProviderConfig>(configPath(ecosystemId, providerId), {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  async deleteProviderConfig(ecosystemId: string, providerId: string): Promise<void> {
    await authedRequest(configPath(ecosystemId, providerId), { method: "DELETE" });
  },

  // ── id/rdid-addressed provider-config CRUD ───────────────────────────────────

  /** Create a new provider config under the ecosystem. POSTs to the collection path
   *  with a `providerId` + `name` and the config input fields; returns the masked row. */
  async createProviderConfig(
    ecosystemId: string,
    body: CreateProviderConfigBody,
  ): Promise<MaskedProviderConfig> {
    return authedJson<MaskedProviderConfig>(configPath(ecosystemId), {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** One masked config addressed by its id/rdid, or null when it doesn't exist
   *  (backend 404). */
  async getProviderConfigById(
    ecosystemId: string,
    configId: string,
  ): Promise<MaskedProviderConfig | null> {
    try {
      return await authedJson<MaskedProviderConfig>(configByIdPath(ecosystemId, configId));
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  },

  /** Update an existing provider config addressed by its id/rdid. A blank/absent
   *  `clientSecret` in `body` preserves the stored secret. Returns the masked row. */
  async updateProviderConfig(
    ecosystemId: string,
    configId: string,
    body: ProviderConfigInput & { name?: string },
  ): Promise<MaskedProviderConfig> {
    return authedJson<MaskedProviderConfig>(configByIdPath(ecosystemId, configId), {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  /** Delete a provider config addressed by its id/rdid. */
  async deleteProviderConfigById(ecosystemId: string, configId: string): Promise<void> {
    await authedRequest(configByIdPath(ecosystemId, configId), { method: "DELETE" });
  },

  // ── connections (linked accounts for the caller's active ecosystem) ──────────

  /** The connections OWNED by ecosystem `ecosystemId` (secrets redacted), across all
   *  providers. The backend authorizes the caller against the ecosystem (403 otherwise). */
  async listConnections(ecosystemId: string): Promise<SafeConnection[]> {
    const { connections } = await authedJson<{ connections: SafeConnection[] }>(
      `${BASE}?ecosystemId=${enc(ecosystemId)}`,
    );
    return connections;
  },

  /** Finish a connect for any auth method and persist the connection. The `body`
   *  names the owning ecosystem in `ecosystemId`; the backend authorizes the caller
   *  against it (403 otherwise) before persisting the connection under it. */
  async connect(body: ConnectRequest): Promise<SafeConnection> {
    return authedJson<SafeConnection>(`${BASE}/connect`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** Disconnect (soft-delete) a connection the caller owns. */
  async disconnect(connectionId: string): Promise<void> {
    await authedRequest(`${BASE}/${enc(connectionId)}`, { method: "DELETE" });
  },

  /** Trigger an immediate sync. Throws AuthHttpError(503) when no worker is
   *  registered for the provider yet (caller shows an inline "not available" note). */
  async sync(connectionId: string): Promise<void> {
    await authedRequest(`${BASE}/${enc(connectionId)}/sync`, { method: "POST" });
  },

  /** Update a connection's caller-tunable sync settings (gmail today). */
  async patchSettings(
    connectionId: string,
    body: SyncSettingsBody,
  ): Promise<SyncSettingsResult> {
    return authedJson<SyncSettingsResult>(`${BASE}/${enc(connectionId)}/settings`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  // ── OAuth / instance / link-token start endpoints ────────────────────────────

  /** Get the provider's OAuth authorize URL + the signed round-trip `state`, for the
   *  target ecosystem (its client id drives the URL; caller authorized against it). */
  async getAuthUrl(
    providerId: string,
    params: { ecosystemId: string; redirectUri: string; serviceType?: string; scopes?: string },
  ): Promise<AuthUrlResult> {
    const qs = new URLSearchParams({
      ecosystemId: params.ecosystemId,
      redirectUri: params.redirectUri,
    });
    if (params.serviceType) qs.set("serviceType", params.serviceType);
    if (params.scopes) qs.set("scopes", params.scopes);
    return authedJson<AuthUrlResult>(
      `${BASE}/providers/${enc(providerId)}/auth-url?${qs.toString()}`,
    );
  },

  /** Register a self-hosted OAuth instance (Mastodon) → `{ state, authorizeUrl, clientId }`. */
  async registerInstance(
    providerId: string,
    body: RegisterInstanceBody,
  ): Promise<RegisterInstanceResult> {
    return authedJson<RegisterInstanceResult>(
      `${BASE}/providers/${enc(providerId)}/register-instance`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  /** Mint a Plaid Link token for the provider. */
  async createLinkToken(
    providerId: string,
    body?: LinkTokenBody,
  ): Promise<{ linkToken: string }> {
    return authedJson<{ linkToken: string }>(
      `${BASE}/providers/${enc(providerId)}/link-token`,
      { method: "POST", body: JSON.stringify(body ?? {}) },
    );
  },
};
