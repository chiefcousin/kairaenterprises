import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { SignupForm } from "@/components/storefront/signup-form";
import { SigninForm } from "@/components/storefront/signin-form";

export const metadata: Metadata = {
  title: "Sign Up - Kaira Enterprises",
  description:
    "Create your business account to browse and order from Kaira Enterprises",
};

function AuthContent({ mode }: { mode: string | undefined }) {
  return mode === "signin" ? <SigninForm /> : <SignupForm />;
}

export default function SignupPage({
  searchParams,
}: {
  searchParams: { mode?: string; blocked?: string };
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/signup" className="inline-flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight">
              Kaira Enterprises
            </span>
          </Link>
        </div>

        <Suspense>
          <AuthContent mode={searchParams.mode} />
        </Suspense>

        <p className="mt-4 text-center text-xs text-muted-foreground">
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
      </div>
    </div>
  );
}
