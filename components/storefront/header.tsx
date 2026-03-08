import Link from "next/link";
import { Package, User } from "lucide-react";
import { CategoryNav } from "./category-nav";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "@/components/theme-toggle";

export function StorefrontHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Package className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">Kaira Enterprises</span>
        </Link>
        <div className="hidden flex-1 px-8 md:block">
          <SearchBar />
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/products"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            All Toys
          </Link>
          <ThemeToggle />
          <Link
            href="/profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label="My Profile"
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="border-t md:hidden">
        <div className="mx-auto max-w-7xl px-4 py-2">
          <SearchBar />
        </div>
      </div>
      <CategoryNav />
    </header>
  );
}
