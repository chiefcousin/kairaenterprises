"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DeleteProductButton } from "@/components/admin/delete-product-button";
import { BulkImportButton } from "@/components/admin/bulk-import";
import { useUserRole } from "@/components/admin/role-context";

export { BulkImportButton };

export function ProductActions({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const role = useUserRole();
  const canEdit = role === "admin" || role === "partner";

  if (!canEdit) return null;

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/products/${productId}/edit`}>Edit</Link>
      </Button>
      <DeleteProductButton productId={productId} productName={productName} />
    </div>
  );
}

export function AddProductButton() {
  const role = useUserRole();
  const canEdit = role === "admin" || role === "partner";

  if (!canEdit) return null;

  return (
    <Button asChild>
      <Link href="/admin/products/new">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
        Add Product
      </Link>
    </Button>
  );
}
