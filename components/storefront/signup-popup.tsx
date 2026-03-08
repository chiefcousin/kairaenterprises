"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { playWelcomeGreeting } from "@/lib/welcome-sound";

const STORAGE_KEY = "ka_customer_registered";

export function SignupPopup() {
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) return;
    // Show immediately — signup is required
    setVisible(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save details");
      localStorage.setItem(STORAGE_KEY, "1");
      localStorage.setItem("ka_customer_phone", phone);
      playWelcomeGreeting();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl">
        {!done ? (
          <>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Sign Up to Continue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an account to browse and order from our toy collection.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="popup-name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="popup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Sharma"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="popup-phone">
                  WhatsApp Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="popup-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Include country code (e.g. +91 for India)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="popup-address">Delivery Address</Label>
                <Input
                  id="popup-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 MG Road, Mumbai"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign Up & Start Shopping
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                By signing up you agree to our{" "}
                <Link
                  href="/privacy"
                  className="underline hover:text-foreground"
                  target="_blank"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </>
        ) : (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <User className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">You&apos;re all set!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome, {name}! Your details are saved. Happy shopping at Kaira Enterprises!
            </p>
            <Button className="mt-5 w-full" onClick={() => setVisible(false)}>
              Start Shopping
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
