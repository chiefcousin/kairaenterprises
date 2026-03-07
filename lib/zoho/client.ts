import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Zoho config — all values come from store_settings (admin panel), not env vars
// ---------------------------------------------------------------------------

interface ZohoConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  orgId: string;
  domain: string; // "in" | "com" | "eu" | "com.au" | "jp"
}

/** Reads Zoho integration config from the database. */
export async function getZohoConfig(): Promise<ZohoConfig | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("store_settings")
    .select("key, value")
    .in("key", [
      "zoho_client_id",
      "zoho_client_secret",
      "zoho_redirect_uri",
      "zoho_org_id",
      "zoho_domain",
    ]);

  if (!data || data.length === 0) return null;

  const map = Object.fromEntries(data.map((r) => [r.key, r.value]));

  // Require at least client_id and client_secret to consider it configured
  if (!map.zoho_client_id || !map.zoho_client_secret) return null;

  return {
    clientId: map.zoho_client_id,
    clientSecret: map.zoho_client_secret,
    redirectUri: map.zoho_redirect_uri ?? "",
    orgId: map.zoho_org_id ?? "",
    domain: map.zoho_domain || "in",
  };
}

function getAccountsUrl(domain: string) {
  return `https://accounts.zoho.${domain}/oauth/v2`;
}

function getApiBase(domain: string) {
  return `https://www.zohoapis.${domain}/inventory/v1`;
}

// ---------------------------------------------------------------------------
// Token storage (uses store_settings key-value table via admin client)
// ---------------------------------------------------------------------------

interface TokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
}

async function getTokenRecord(): Promise<TokenRecord | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("store_settings")
    .select("key, value")
    .in("key", [
      "zoho_access_token",
      "zoho_refresh_token",
      "zoho_token_expires_at",
    ]);

  if (!data || data.length === 0) return null;

  const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
  if (!map.zoho_refresh_token) return null;

  return {
    accessToken: map.zoho_access_token ?? "",
    refreshToken: map.zoho_refresh_token,
    expiresAt: parseInt(map.zoho_token_expires_at ?? "0", 10),
  };
}

async function storeTokens(
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number
): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = Date.now() + expiresInSeconds * 1000 - 60_000;
  const now = new Date().toISOString();

  const rows = [
    { key: "zoho_access_token", value: accessToken, updated_at: now },
    { key: "zoho_refresh_token", value: refreshToken, updated_at: now },
    {
      key: "zoho_token_expires_at",
      value: String(expiresAt),
      updated_at: now,
    },
  ];

  for (const row of rows) {
    await supabase
      .from("store_settings")
      .upsert(row, { onConflict: "key" });
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const config = await getZohoConfig();
  if (!config) throw new Error("Zoho is not configured");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });

  const tokenUrl = `${getAccountsUrl(config.domain)}/token`;
  const res = await fetch(`${tokenUrl}?${params.toString()}`, {
    method: "POST",
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Error(`Zoho token refresh failed (${res.status}): ${body}`);
  }

  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(
      `Zoho token refresh returned invalid JSON (${res.status}): ${body.slice(0, 200)}`
    );
  }

  if (json.error) {
    throw new Error(`Zoho token error: ${json.error}`);
  }

  const newRefreshToken = json.refresh_token ?? refreshToken;
  await storeTokens(json.access_token, newRefreshToken, json.expires_in ?? 3600);
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns a valid access token, auto-refreshing if expired. */
export async function getValidAccessToken(): Promise<string> {
  const tokens = await getTokenRecord();
  if (!tokens) {
    throw new Error(
      "Zoho Inventory is not connected. Complete OAuth from Admin → Settings."
    );
  }

  if (Date.now() < tokens.expiresAt && tokens.accessToken) {
    return tokens.accessToken;
  }

  return refreshAccessToken(tokens.refreshToken);
}

/** Stores tokens after the initial OAuth code exchange. */
export async function storeInitialTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<void> {
  await storeTokens(accessToken, refreshToken, expiresIn);
}

/** Returns true if Zoho has been connected (refresh token exists). */
export async function isZohoConnected(): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "zoho_refresh_token")
    .maybeSingle();
  return !!data?.value;
}

/** Returns true if Zoho credentials are configured (client_id + secret exist). */
export async function isZohoConfigured(): Promise<boolean> {
  const config = await getZohoConfig();
  return config !== null;
}

/**
 * Authenticated fetch wrapper for Zoho Inventory API.
 * Automatically injects Authorization header and organization_id query param.
 *
 * For GET/DELETE: sends as-is.
 * For POST/PUT: if `body` is provided, wraps it as form-encoded `JSONString`
 * parameter (required by Zoho Inventory V1 API).
 */
export async function zohoFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getValidAccessToken();
  const config = await getZohoConfig();
  if (!config) throw new Error("Zoho is not configured");

  const url = new URL(`${getApiBase(config.domain)}${path}`);
  url.searchParams.set("organization_id", config.orgId);

  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${token}`,
  };

  let body = options.body;

  // Zoho Inventory V1 API expects POST/PUT data as form-encoded JSONString
  if ((method === "POST" || method === "PUT") && body) {
    const jsonPayload = typeof body === "string" ? body : JSON.stringify(body);
    const formData = new URLSearchParams();
    formData.set("JSONString", jsonPayload);
    body = formData.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  return fetch(url.toString(), {
    ...options,
    method,
    body,
    headers,
  });
}
