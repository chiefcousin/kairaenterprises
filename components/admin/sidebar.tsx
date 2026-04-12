"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/components/admin/role-context";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  MessageCircle,
  Boxes,
  LogOut,
  Package2,
  Settings,
  BarChart2,
  Users,
  Contact,
  ShieldBan,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/admin/notifications";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import type { UserRole } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Roles that can see this item. Undefined = all roles. */
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/orders", label: "Orders", icon: MessageCircle },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: Contact, roles: ["admin", "partner"] },
  { href: "/admin/blocked-users", label: "Blocked Users", icon: ShieldBan, roles: ["admin"] },
  { href: "/admin/staff", label: "Staff", icon: Users, roles: ["admin", "partner"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin", "partner"] },
];

function SidebarContent({
  visibleItems,
  pathname,
  role,
  onLogout,
  onNavClick,
}: {
  visibleItems: NavItem[];
  pathname: string;
  role: UserRole;
  onLogout: () => void;
  onNavClick?: () => void;
}) {
  return (
    <>
      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="mb-2 flex items-center justify-between px-3">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            {role}
          </span>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useUserRole();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Package2 className="h-5 w-5 text-primary" />
        <span className="font-bold">Kaira Admin</span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetTitle className="flex h-14 items-center gap-2 border-b px-4">
            <Package2 className="h-6 w-6 text-primary" />
            <span className="font-bold">Kaira Admin</span>
          </SheetTitle>
          <SidebarContent
            visibleItems={visibleItems}
            pathname={pathname}
            role={role}
            onLogout={handleLogout}
            onNavClick={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Package2 className="h-6 w-6 text-primary" />
          <span className="flex-1 font-bold">Kaira Admin</span>
          <NotificationBell />
        </div>
        <SidebarContent
          visibleItems={visibleItems}
          pathname={pathname}
          role={role}
          onLogout={handleLogout}
        />
      </aside>
    </>
  );
}
