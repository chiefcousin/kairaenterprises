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
  UserPlus,
  Trash2,
  Loader2,
  Search,
  MessageCircle,
  Contact,
  Phone,
  MapPin,
  ShieldBan,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/components/admin/role-context";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const { toast } = useToast();
  const myRole = useUserRole();
  const canDelete = myRole === "admin";
  const canAdd = myRole === "admin" || myRole === "partner";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);

  // Add form state
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("+91");
  const [addAddress, setAddAddress] = useState("");
  const [adding, setAdding] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/customers");
      const data = await res.json();
      if (data.customers) setCustomers(data.customers);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, search]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          phone: addPhone,
          address: addAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add customer");
      toast({
        title: "Customer added",
        description: `${addName} has been added.`,
      });
      setShowAddDialog(false);
      setAddName("");
      setAddPhone("+91");
      setAddAddress("");
      loadCustomers();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to add customer",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(customer: Customer) {
    if (
      !confirm(
        `Delete ${customer.name} (${customer.phone})? This cannot be undone.`
      )
    )
      return;
    setRemovingId(customer.id);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast({
        title: "Customer deleted",
        description: `${customer.name} has been removed.`,
      });
      loadCustomers();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to delete customer",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  }

  async function handleBlock(customer: Customer) {
    if (
      !confirm(
        `Block ${customer.name} (${customer.phone})? They will not be able to log in again.`
      )
    )
      return;
    setBlockingId(customer.id);
    try {
      const res = await fetch("/api/admin/blocked-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customer.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to block");
      toast({
        title: "Customer blocked",
        description: `${customer.name} has been blocked and can no longer log in.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to block customer",
        variant: "destructive",
      });
    } finally {
      setBlockingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {customers.length} registered customer
            {customers.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canAdd && (
          <Button onClick={() => setShowAddDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Contact className="h-5 w-5" />
            All Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Contact className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">
                {search
                  ? "No customers match your search."
                  : "No customers yet."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {customer.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </span>
                      {customer.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">
                            {customer.address}
                          </span>
                        </span>
                      )}
                      <span>
                        Joined{" "}
                        {new Date(customer.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-green-600 hover:text-green-700"
                    >
                      <a
                        href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Message on WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-orange-600 hover:text-orange-700"
                        onClick={() => handleBlock(customer)}
                        disabled={blockingId === customer.id}
                        title="Block user"
                      >
                        {blockingId === customer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldBan className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemove(customer)}
                        disabled={removingId === customer.id}
                      >
                        {removingId === customer.id ? (
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

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="add-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Rahul Sharma"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-phone">
                WhatsApp Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-phone"
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="+919876543210"
                required
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g. +91 for India)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-address">Delivery Address</Label>
              <Input
                id="add-address"
                value={addAddress}
                onChange={(e) => setAddAddress(e.target.value)}
                placeholder="123 MG Road, Mumbai"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={adding} className="flex-1">
                {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Customer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={adding}
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
