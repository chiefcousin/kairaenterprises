"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldBan,
  ShieldOff,
  Loader2,
  Search,
  Phone,
  Mail,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/components/admin/role-context";

interface BlockedUser {
  id: string;
  phone: string | null;
  email: string | null;
  reason: string | null;
  created_at: string;
}

export default function BlockedUsersPage() {
  const { toast } = useToast();
  const myRole = useUserRole();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Block form state
  const [blockPhone, setBlockPhone] = useState("");
  const [blockEmail, setBlockEmail] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blocking, setBlocking] = useState(false);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blocked-users");
      const data = await res.json();
      if (data.blocked) setBlocked(data.blocked);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load blocked users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBlocked();
  }, [loadBlocked]);

  const filtered = useMemo(() => {
    if (!search.trim()) return blocked;
    const q = search.toLowerCase();
    return blocked.filter(
      (b) =>
        b.phone?.includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.reason?.toLowerCase().includes(q)
    );
  }, [blocked, search]);

  async function handleBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!blockPhone.trim() && !blockEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number or email address",
        variant: "destructive",
      });
      return;
    }
    setBlocking(true);
    try {
      const res = await fetch("/api/admin/blocked-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: blockPhone.trim() || null,
          email: blockEmail.trim() || null,
          reason: blockReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to block user");
      toast({
        title: "User blocked",
        description: "The user has been blocked and can no longer log in.",
      });
      setShowBlockDialog(false);
      setBlockPhone("");
      setBlockEmail("");
      setBlockReason("");
      loadBlocked();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to block user",
        variant: "destructive",
      });
    } finally {
      setBlocking(false);
    }
  }

  async function handleUnblock(user: BlockedUser) {
    if (
      !confirm(
        `Unblock ${user.phone || user.email}? They will be able to log in again.`
      )
    )
      return;
    setRemovingId(user.id);
    try {
      const res = await fetch("/api/admin/blocked-users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unblock");
      toast({
        title: "User unblocked",
        description: `${user.phone || user.email} has been unblocked.`,
      });
      loadBlocked();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to unblock user",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  }

  if (myRole !== "admin") {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Only admins can manage blocked users.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blocked Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {blocked.length} blocked user{blocked.length !== 1 ? "s" : ""}
            {" "}&mdash; blocked users cannot log in or sign up.
          </p>
        </div>
        <Button onClick={() => setShowBlockDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Block User
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by phone, email, or reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Blocked Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldBan className="h-5 w-5" />
            Blocked Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <ShieldBan className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">
                {search
                  ? "No blocked users match your search."
                  : "No blocked users yet."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
                      {user.phone && (
                        <span className="flex items-center gap-1 font-medium">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {user.phone}
                        </span>
                      )}
                      {user.email && (
                        <span className="flex items-center gap-1 font-medium">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {user.email}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {user.reason && <span>Reason: {user.reason}</span>}
                      <span>
                        Blocked{" "}
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 hover:text-green-700 hover:border-green-300"
                    onClick={() => handleUnblock(user)}
                    disabled={removingId === user.id}
                  >
                    {removingId === user.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldOff className="mr-1 h-4 w-4" />
                    )}
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block User Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBlock} className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Blocked users will not be able to log in or sign up. Enter at
              least a phone number or email.
            </p>
            <div className="space-y-2">
              <Label htmlFor="block-phone">Phone Number</Label>
              <Input
                id="block-phone"
                type="tel"
                value={blockPhone}
                onChange={(e) => setBlockPhone(e.target.value)}
                placeholder="+919876543210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-email">Email Address</Label>
              <Input
                id="block-email"
                type="email"
                value={blockEmail}
                onChange={(e) => setBlockEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-reason">Reason (optional)</Label>
              <Input
                id="block-reason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Spam, fraud, abuse"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={blocking}
                variant="destructive"
                className="flex-1"
              >
                {blocking && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Block User
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBlockDialog(false)}
                disabled={blocking}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
