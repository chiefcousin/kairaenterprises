"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ZohoSettingsProps {
  isConfigured: boolean;
  isConnected: boolean;
  lastSyncAt: string | null;
  syncStatus: string;
  syncError: string | null;
  config: {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    org_id: string;
    domain: string;
  };
}

const ZOHO_REGIONS = [
  { value: "in", label: "India (.in)" },
  { value: "com", label: "United States (.com)" },
  { value: "eu", label: "Europe (.eu)" },
  { value: "com.au", label: "Australia (.com.au)" },
  { value: "jp", label: "Japan (.jp)" },
  { value: "com.cn", label: "China (.com.cn)" },
];

export function ZohoSettings({
  isConfigured,
  isConnected,
  lastSyncAt,
  syncError: initialSyncError,
  config: initialConfig,
}: ZohoSettingsProps) {
  const router = useRouter();
  const [showSetup, setShowSetup] = useState(!isConfigured);
  const [saving, setSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    total: number;
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(initialSyncError);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_id: initialConfig.client_id,
    client_secret: initialConfig.client_secret,
    redirect_uri: initialConfig.redirect_uri,
    org_id: initialConfig.org_id,
    domain: initialConfig.domain || "in",
  });

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "zoho", config: formData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setSaveMessage("Credentials saved! You can now connect to Zoho.");
      setShowSetup(false);
      router.refresh();
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : "Failed to save credentials"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Remove Zoho integration? This will delete all credentials and disconnect Zoho.")) {
      return;
    }
    setDisconnecting(true);
    try {
      await fetch("/api/integrations?platform=zoho", { method: "DELETE" });
      router.refresh();
    } catch {
      alert("Failed to disconnect. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const res = await fetch("/api/zoho/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setSyncError(json.error ?? "Sync failed");
      } else {
        setSyncResult(json.result);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsSyncing(false);
    }
  }

  // ---- Setup form (shown when not configured or when editing) ----
  if (showSetup) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter your Zoho API credentials. Create a Server-based Application at{" "}
          <strong>api-console.zoho.com</strong> and set the redirect URI to:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            https://yourdomain.com/api/zoho/callback
          </code>
        </p>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zoho_domain">Zoho Region</Label>
            <Select
              value={formData.domain}
              onValueChange={(v) => setFormData({ ...formData, domain: v })}
            >
              <SelectTrigger id="zoho_domain">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZOHO_REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoho_client_id">Client ID</Label>
            <Input
              id="zoho_client_id"
              value={formData.client_id}
              onChange={(e) =>
                setFormData({ ...formData, client_id: e.target.value })
              }
              placeholder="1000.XXXXXXXXXXXXXXXX"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoho_client_secret">Client Secret</Label>
            <Input
              id="zoho_client_secret"
              type="password"
              value={formData.client_secret}
              onChange={(e) =>
                setFormData({ ...formData, client_secret: e.target.value })
              }
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoho_org_id">Organization ID</Label>
            <Input
              id="zoho_org_id"
              value={formData.org_id}
              onChange={(e) =>
                setFormData({ ...formData, org_id: e.target.value })
              }
              placeholder="Find in Zoho Inventory → Settings → Organization Profile"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoho_redirect_uri">Redirect URI</Label>
            <Input
              id="zoho_redirect_uri"
              value={formData.redirect_uri}
              onChange={(e) =>
                setFormData({ ...formData, redirect_uri: e.target.value })
              }
              placeholder="https://yourdomain.com/api/zoho/callback"
              required
            />
            <p className="text-xs text-muted-foreground">
              Must match the redirect URI in your Zoho API Console app.
            </p>
          </div>

          {saveMessage && (
            <p className="text-sm text-muted-foreground">{saveMessage}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Credentials
            </Button>
            {isConfigured && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSetup(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // ---- Connected / configured view ----
  return (
    <div className="space-y-5">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isConnected ? "bg-green-500" : "bg-yellow-400"
            }`}
          />
          <span className="text-sm font-medium">
            {isConnected
              ? "Connected to Zoho Inventory"
              : "Credentials saved — not yet connected"}
          </span>
        </div>

        <div className="flex gap-2">
          {!isConnected && (
            <Button variant="default" size="sm" asChild>
              <a href="/api/zoho/auth">Connect Zoho</a>
            </Button>
          )}
          {isConnected && (
            <Button variant="outline" size="sm" asChild>
              <a href="/api/zoho/auth">Reconnect</a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSetup(true)}
          >
            Edit Credentials
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Remove"
            )}
          </Button>
        </div>
      </div>

      {/* Sync controls — only when connected */}
      {isConnected && (
        <>
          {/* Manual sync */}
          <div className="flex items-center gap-4 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Syncing…
                </span>
              ) : (
                "Sync Products from Zoho"
              )}
            </Button>

            {lastSyncAt && (
              <span className="text-xs text-muted-foreground">
                Last synced:{" "}
                {new Date(lastSyncAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>

          {/* Sync result */}
          {syncResult && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-800">Sync complete</p>
              <p className="text-green-700">
                {syncResult.total} items from Zoho —{" "}
                <strong>{syncResult.created}</strong> created,{" "}
                <strong>{syncResult.updated}</strong> updated
                {syncResult.errors.length > 0 && (
                  <span className="text-red-700">
                    , {syncResult.errors.length} errors
                  </span>
                )}
              </p>
              {syncResult.errors.length > 0 && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-xs text-green-600 hover:underline">
                    View errors
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {syncResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-700">
                        {e}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {syncError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
              <p className="font-medium text-red-800">Sync error</p>
              <p className="text-red-700">{syncError}</p>
            </div>
          )}

          {/* How it works */}
          <div className="border-t pt-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">How it works</p>
            <p>
              <strong>Auto-sync (daily):</strong> Products are automatically
              synced from Zoho Inventory every day at midnight UTC (5:30 AM IST).
              Names, descriptions, prices, and stock levels are kept up to date.
              You can also click the button above to sync immediately.
            </p>
            <p>
              <strong>Kaira Enterprises → Zoho:</strong> When you mark a
              WhatsApp order as <strong>Confirmed</strong> in the Orders page, a
              Sales Order is automatically created in Zoho Inventory,
              decrementing stock.
            </p>
            <p>
              <strong>Compare At Price:</strong> Add a custom field labeled{" "}
              <em>Compare At Price</em> to your Zoho items to sync sale prices
              into Kaira Enterprises.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
