import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "@/components/admin/settings-form";
import { ZohoSettings } from "@/components/admin/zoho-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage() {
  const supabase = createClient();

  // Fetch all store settings
  const { data: settings } = await supabase.from("store_settings").select("*");

  // Convert array to object for easier access
  const settingsObj =
    settings?.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      },
      {} as Record<string, string>
    ) ?? {};

  // Zoho-specific settings via admin client (bypasses RLS for token/credential fields)
  const adminSupabase = createAdminClient();
  const { data: zohoRows } = await adminSupabase
    .from("store_settings")
    .select("key, value")
    .in("key", [
      "zoho_client_id",
      "zoho_client_secret",
      "zoho_redirect_uri",
      "zoho_org_id",
      "zoho_domain",
      "zoho_refresh_token",
      "zoho_last_sync_at",
      "zoho_sync_status",
      "zoho_sync_error",
    ]);

  const zohoMap = Object.fromEntries(
    (zohoRows ?? []).map((r) => [r.key, r.value ?? ""])
  );

  const isConfigured = !!(zohoMap.zoho_client_id && zohoMap.zoho_client_secret);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Store Settings</h1>
        <p className="text-muted-foreground">
          Configure your store information and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Update your store name, contact information, and homepage content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settingsObj} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zoho Inventory Integration</CardTitle>
          <CardDescription>
            Sync products from Zoho and push confirmed orders back to Zoho
            automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZohoSettings
            isConfigured={isConfigured}
            isConnected={!!zohoMap.zoho_refresh_token}
            lastSyncAt={zohoMap.zoho_last_sync_at || null}
            syncStatus={zohoMap.zoho_sync_status || "idle"}
            syncError={zohoMap.zoho_sync_error || null}
            config={{
              client_id: zohoMap.zoho_client_id || "",
              client_secret: zohoMap.zoho_client_secret || "",
              redirect_uri: zohoMap.zoho_redirect_uri || "",
              org_id: zohoMap.zoho_org_id || "",
              domain: zohoMap.zoho_domain || "in",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
