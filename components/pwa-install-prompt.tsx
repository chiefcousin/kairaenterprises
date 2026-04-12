"use client";

import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Don't show if already installed or previously dismissed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);
    const dismissed = localStorage.getItem("pwa-install-dismissed");

    if (isStandalone) return;

    // Check if dismissed within last 7 days
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Detect iOS (no beforeinstallprompt support)
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    setIsIOS(isiOS);

    if (isiOS) {
      // Show iOS instructions after a short delay
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android / desktop Chrome — listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  }

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] animate-in slide-in-from-top duration-500">
      <div className="mx-auto max-w-lg px-3 pt-3">
        <div className="flex items-center gap-3 rounded-xl border bg-background p-3 shadow-lg">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              Install Kaira Enterprises
            </p>
            {isIOS ? (
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                Tap{" "}
                <span className="inline-block rounded border px-1 text-[10px] font-medium">
                  Share
                </span>{" "}
                then &quot;Add to Home Screen&quot;
              </p>
            ) : (
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                Add to your home screen for quick access
              </p>
            )}
          </div>
          {!isIOS && (
            <Button size="sm" onClick={handleInstall} className="shrink-0 h-8 text-xs">
              Install
            </Button>
          )}
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
