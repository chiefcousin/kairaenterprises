"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "ka_customer_registered";

/**
 * Signup popup is no longer used inline — we redirect to /signup instead.
 * This component is kept as a no-op so existing imports don't break.
 */
export function SignupPopup() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      router.push("/signup");
    }
  }, [router]);

  return null;
}
