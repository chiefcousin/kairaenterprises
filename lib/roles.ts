import { createAdminClient } from "@/lib/supabase/admin";

export type UserRole = "admin" | "partner" | "staff";

/** Fetches the role for a given user_id. No role row = admin. */
export async function getUserRole(userId: string): Promise<UserRole> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.role as UserRole) ?? "admin";
}

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

/** Can create/edit/delete products, categories, inventory */
export function canManageProducts(role: UserRole): boolean {
  return role === "admin" || role === "partner";
}

/** Can update order status and notes */
export function canManageOrders(role: UserRole): boolean {
  return role === "admin" || role === "partner";
}

/** Can delete customers */
export function canDeleteCustomers(role: UserRole): boolean {
  return role === "admin";
}

/** Can view customers (all roles except staff? Actually let's allow all) */
export function canViewCustomers(role: UserRole): boolean {
  return role === "admin" || role === "partner";
}

/** Can add customers */
export function canAddCustomers(role: UserRole): boolean {
  return role === "admin" || role === "partner";
}

/** Can invite staff members */
export function canInviteStaff(role: UserRole): boolean {
  return role === "admin" || role === "partner";
}

/** Can remove staff/partner/admin members */
export function canRemoveStaff(role: UserRole): boolean {
  return role === "admin";
}

/** Roles a user is allowed to assign when inviting */
export function assignableRoles(role: UserRole): UserRole[] {
  if (role === "admin") return ["partner", "staff"];
  if (role === "partner") return ["staff"];
  return [];
}

/** Can access settings page */
export function canManageSettings(role: UserRole): boolean {
  return role === "admin" || role === "partner";
}

/** Can access staff management page */
export function canViewStaffPage(role: UserRole): boolean {
  return role === "admin" || role === "partner";
}
