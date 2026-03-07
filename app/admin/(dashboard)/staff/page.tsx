"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Trash2, Users, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/components/admin/role-context";
import type { UserRole } from "@/lib/roles";

interface StaffMember {
  user_id: string;
  role: "admin" | "partner" | "staff";
  email: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  partner: "Partner — full access except removing users",
  staff: "Staff — view only",
};

export default function StaffPage() {
  const { toast } = useToast();
  const myRole = useUserRole();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"partner" | "staff">("staff");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Roles this user can assign
  const canAssign: UserRole[] =
    myRole === "admin" ? ["partner", "staff"] : ["staff"];
  const canRemove = myRole === "admin";
  const canInvite = myRole === "admin" || myRole === "partner";

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      if (data.staff) setStaff(data.staff);
    } catch {
      toast({ title: "Error", description: "Failed to load staff list", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      toast({ title: "Invite sent!", description: `${inviteEmail} will receive an email to set up their account.` });
      setShowInviteDialog(false);
      setInviteEmail("");
      loadStaff();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to invite staff",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId: string, email: string) {
    if (!confirm(`Remove access for ${email}? They will no longer be able to log in to the admin panel.`)) return;
    setRemovingId(userId);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove");
      toast({ title: "Access removed", description: `${email} no longer has admin access.` });
      loadStaff();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove staff",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  }

  const roleColor = (role: string) => {
    if (role === "admin") return "bg-purple-100 text-purple-700";
    if (role === "partner") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage who can access the admin panel.
          </p>
        </div>
        {canInvite && (
          <Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Staff
          </Button>
        )}
      </div>

      {/* Role legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="flex items-start gap-2">
              <Badge className="bg-purple-100 text-purple-700 shrink-0 mt-0.5">Admin</Badge>
              <p className="text-muted-foreground">Full access to everything including removing users.</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-700 shrink-0 mt-0.5">Partner</Badge>
              <p className="text-muted-foreground">Full access to products, orders, customers, and settings. Cannot remove users. Can invite staff.</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-gray-100 text-gray-700 shrink-0 mt-0.5">Staff</Badge>
              <p className="text-muted-foreground">View-only access. Cannot edit products, orders, or any data.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : staff.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">No staff members yet. Invite someone to get started.</p>
            </div>
          ) : (
            <div className="divide-y">
              {staff.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium text-sm">{member.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${roleColor(member.role)}`}
                    >
                      {member.role}
                    </span>
                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemove(member.user_id, member.email)}
                        disabled={removingId === member.user_id}
                      >
                        {removingId === member.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="staff@example.com"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as "partner" | "staff")}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canAssign.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              They will receive an email to set a password and access the admin panel.
            </p>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={inviting} className="flex-1">
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invite
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInviteDialog(false)}
                disabled={inviting}
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
