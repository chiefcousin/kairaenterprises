"use client";

import { useState } from "react";
import { User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { playWelcomeGreeting } from "@/lib/welcome-sound";

export function SignupForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      localStorage.setItem("ka_customer_registered", "1");
      localStorage.setItem("ka_customer_phone", phone);
      playWelcomeGreeting();
      // Full reload so middleware picks up the new cookie
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-card p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Create Your Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign up to browse and order from our amazing toy collection!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-name">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signup-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rahul Sharma"
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-phone">
            WhatsApp Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signup-phone"
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
          <Label htmlFor="signup-address">Delivery Address</Label>
          <Input
            id="signup-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 MG Road, Mumbai"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign Up & Start Shopping
        </Button>
      </form>
    </div>
  );
}
