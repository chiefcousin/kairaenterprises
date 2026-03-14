import { Package, MapPin, Mail, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getStoreSettings } from "@/lib/store-settings";

export async function StorefrontFooter() {
  const settings = await getStoreSettings();

  const storeName = settings.store_name || "Kaira Enterprises";
  const address = settings.store_address;
  const email = settings.store_email;
  const instagramUrl = settings.instagram_url;
  const facebookUrl = settings.facebook_url;
  const googleMapsUrl = settings.google_maps_url;
  const footerText =
    settings.footer_text ||
    `© ${new Date().getFullYear()} ${storeName}. All rights reserved.`;

  return (
    <footer className="border-t bg-muted/40 pb-6 pt-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand + Contact */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">{storeName}</span>
            </div>
            {address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{address}</span>
              </div>
            )}
            {email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <a href={`mailto:${email}`} className="hover:text-foreground">
                  {email}
                </a>
              </div>
            )}
            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Find us on Google Maps
              </a>
            )}
          </div>

          {/* Navigation */}
          <div className="space-y-3">
            <h4 className="font-semibold">Shop</h4>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/products" className="hover:text-foreground">
                All Toys
              </Link>
              <Link
                href="/products?is_featured=true"
                className="hover:text-foreground"
              >
                Featured
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy Policy
              </Link>
            </nav>
          </div>

          {/* Social */}
          <div className="space-y-3">
            <h4 className="font-semibold">Follow Us</h4>
            <div className="flex gap-3">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
              )}
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
              )}
            </div>
            {!instagramUrl && !facebookUrl && (
              <p className="text-xs text-muted-foreground">
                Add social links in admin settings.
              </p>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          {footerText}
        </div>

        {/* Branding */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span>Powered by</span>
          <Image
            src="/SuperCousins_Logo_Black.png"
            alt="SuperCousins"
            width={100}
            height={24}
            className="dark:invert"
          />
        </div>
      </div>
    </footer>
  );
}
