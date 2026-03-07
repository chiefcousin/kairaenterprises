import { NextRequest, NextResponse } from "next/server";
import { getZohoConfig, storeInitialTokens } from "@/lib/zoho/client";

/**
 * GET /api/zoho/callback
 * Handles the Zoho OAuth redirect. Exchanges the authorization code for
 * access + refresh tokens and stores them in store_settings.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const settingsUrl = new URL("/admin/settings", request.url);

  if (error || !code) {
    settingsUrl.searchParams.set(
      "zoho_error",
      error ?? "No authorization code received"
    );
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const config = await getZohoConfig();
    if (!config) {
      throw new Error("Zoho credentials not found in settings");
    }

    const tokenUrl = `https://accounts.zoho.${config.domain}/oauth/v2/token`;

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    });

    const res = await fetch(`${tokenUrl}?${params.toString()}`, {
      method: "POST",
    });

    const body = await res.text();

    if (!res.ok) {
      throw new Error(`Token exchange failed (${res.status}): ${body.slice(0, 300)}`);
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`Zoho returned invalid response: ${body.slice(0, 300)}`);
    }

    if (json.error) {
      throw new Error(`Zoho error: ${json.error}`);
    }

    if (!json.refresh_token) {
      throw new Error(
        "No refresh token returned. Revoke app access in Zoho API Console and try again."
      );
    }

    await storeInitialTokens(
      json.access_token,
      json.refresh_token,
      json.expires_in ?? 3600
    );

    settingsUrl.searchParams.set("zoho_connected", "1");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    settingsUrl.searchParams.set("zoho_error", msg);
    return NextResponse.redirect(settingsUrl);
  }
}
