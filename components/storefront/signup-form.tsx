"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const searchParams = useSearchParams();
  const isBlocked = searchParams.get("blocked") === "1";

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("+91");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    isBlocked ? "Your account has been blocked. Please contact support." : ""
  );
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          business_name: businessName,
          phone,
          email: email || undefined,
          address,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl bg-card p-8 shadow-2xl">
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <Building2 className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold">Request Submitted!</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account request has been sent to our team for approval.
            You will be able to sign in once your account is approved.
          </p>
          <Link href="/signup?mode=signin">
            <Button variant="outline" className="mt-5 w-full">
              Go to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Create Your Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Register your business to browse and order from our collection
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
          <Label htmlFor="signup-business">
            Business / Company Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signup-business"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Sharma Toys & Games"
            required
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
          <Label htmlFor="signup-email">Email (optional, can be used to sign in)</Label>
          <Input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="rahul@sharmatoys.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-address">
            Business Address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signup-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 MG Road, Mumbai"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="signup-password">
              Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-confirm">
              Confirm <span className="text-destructive">*</span>
            </Label>
            <Input
              id="signup-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              minLength={6}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Request Approval
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/signup?mode=signin" className="font-medium text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </form>
    </div>
  );
}
