import { AdminSidebar } from "@/components/admin/sidebar";
import { RoleProvider } from "@/components/admin/role-context";

export const dynamic = "force-dynamic";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <AdminSidebar />
        <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-6">{children}</main>
      </div>
    </RoleProvider>
  );
}
