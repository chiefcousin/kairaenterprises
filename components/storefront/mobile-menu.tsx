"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, User, Menu, X } from "lucide-react";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Mobile top bar */}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">Kaira Enterprises</span>
          </Link>
        </div>
        <Link
          href="/profile"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          aria-label="My Profile"
        >
          <User className="h-4 w-4" />
        </Link>
      </div>

      {/* Expanded mobile menu */}
      {open ? (
        <div className="border-t bg-background">
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-3">
            <SearchBar />
            <nav className="flex flex-col gap-1">
              <Link
                href="/products"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                All Toys
              </Link>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                My Profile
              </Link>
            </nav>
            <div className="flex items-center gap-2 px-3">
              <span className="text-xs text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t">
          <div className="mx-auto max-w-7xl px-4 py-2">
            <SearchBar />
          </div>
        </div>
      )}
    </div>
  );
}
