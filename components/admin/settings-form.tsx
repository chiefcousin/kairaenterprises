"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    store_name: settings.store_name || "Kaira Enterprises",
    whatsapp_number: settings.whatsapp_number || "",
    hero_title: settings.hero_title || "Welcome to Kaira Enterprises",
    hero_subtitle: settings.hero_subtitle || "Your favorite local toy store - browse online, order via WhatsApp!",
    currency: settings.currency || "INR",
    store_address: settings.store_address || "",
    store_email: settings.store_email || "",
    footer_text: settings.footer_text || "© 2026 Kaira Enterprises. All rights reserved.",
    instagram_url: settings.instagram_url || "",
    facebook_url: settings.facebook_url || "",
    google_maps_url: settings.google_maps_url || "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      // Update each setting
      for (const [key, value] of Object.entries(formData)) {
        const { error } = await supabase
          .from("store_settings")
          .upsert({
            key,
            value,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "key",
          });

        if (error) throw error;
      }

      alert("Settings saved successfully!");
      router.refresh();
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Error saving settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Store Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Store Information</h3>

        <div className="space-y-2">
          <Label htmlFor="store_name">Store Name</Label>
          <Input
            id="store_name"
            value={formData.store_name}
            onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
            placeholder="Kaira Enterprises"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp_number">
            WhatsApp Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="whatsapp_number"
            type="tel"
            value={formData.whatsapp_number}
            onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
            placeholder="+2348012345678"
            required
          />
          <p className="text-sm text-muted-foreground">
            Include country code (e.g., +234 for Nigeria). No spaces or dashes.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="store_email">Store Email</Label>
          <Input
            id="store_email"
            type="email"
            value={formData.store_email}
            onChange={(e) => setFormData({ ...formData, store_email: e.target.value })}
            placeholder="store@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="store_address">Store Address</Label>
          <Textarea
            id="store_address"
            value={formData.store_address}
            onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
            placeholder="123 Main Street, Lagos, Nigeria"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            placeholder="INR"
            maxLength={3}
          />
          <p className="text-sm text-muted-foreground">
            3-letter currency code (e.g., INR, USD, EUR)
          </p>
        </div>
      </div>

      {/* Homepage Content */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="text-lg font-medium">Homepage Content</h3>

        <div className="space-y-2">
          <Label htmlFor="hero_title">Hero Title</Label>
          <Input
            id="hero_title"
            value={formData.hero_title}
            onChange={(e) => setFormData({ ...formData, hero_title: e.target.value })}
            placeholder="Welcome to Kaira Enterprises"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero_subtitle">Hero Subtitle</Label>
          <Textarea
            id="hero_subtitle"
            value={formData.hero_subtitle}
            onChange={(e) => setFormData({ ...formData, hero_subtitle: e.target.value })}
            placeholder="Your favorite local toy store - browse online, order via WhatsApp!"
            rows={2}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="text-lg font-medium">Footer</h3>

        <div className="space-y-2">
          <Label htmlFor="footer_text">Footer Text</Label>
          <Input
            id="footer_text"
            value={formData.footer_text}
            onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
            placeholder="© 2026 Kaira Enterprises. All rights reserved."
          />
        </div>
      </div>

      {/* Social & Location */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="text-lg font-medium">Social & Location</h3>

        <div className="space-y-2">
          <Label htmlFor="instagram_url">Instagram URL</Label>
          <Input
            id="instagram_url"
            type="url"
            value={formData.instagram_url}
            onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
            placeholder="https://instagram.com/yourstore"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="facebook_url">Facebook Page URL</Label>
          <Input
            id="facebook_url"
            type="url"
            value={formData.facebook_url}
            onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
            placeholder="https://facebook.com/yourpage"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="google_maps_url">Google Maps / Business Profile URL</Label>
          <Input
            id="google_maps_url"
            type="url"
            value={formData.google_maps_url}
            onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
            placeholder="https://maps.app.goo.gl/..."
          />
          <p className="text-sm text-muted-foreground">
            Paste your Google Maps share link or Google Business Profile URL.
          </p>
        </div>
      </div>

      <div className="flex gap-3 border-t pt-6">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.refresh()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
