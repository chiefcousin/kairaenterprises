import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check if a phone number or email is blocked.
 * Returns the block record if found, null otherwise.
 */
export async function isBlocked(opts: { phone?: string; email?: string }) {
  const supabase = createAdminClient();
  const conditions: string[] = [];

  if (opts.phone) {
    const cleanPhone = opts.phone.trim().replace(/\s+/g, "");
    conditions.push(`phone.eq.${cleanPhone}`);
  }
  if (opts.email) {
    conditions.push(`email.eq.${opts.email.trim().toLowerCase()}`);
  }

  if (conditions.length === 0) return null;

  const { data } = await supabase
    .from("blocked_users")
    .select("id, phone, email, reason")
    .or(conditions.join(","))
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
