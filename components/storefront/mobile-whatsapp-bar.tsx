"use client";

import { MessageCircle } from "lucide-react";
import { formatPrice } from "@/lib/whatsapp";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function MobileWhatsAppBar({
  product,
  whatsappNumber,
  disabled,
}: {
  product: { id: string; name: string; price: number; slug: string };
  whatsappNumber: string;
  disabled?: boolean;
}) {
  async function handleOrder() {
    try {
      await fetch("/api/whatsapp-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: 1,
        }),
      });
    } catch {}

    const siteUrl = window.location.origin;
    const url = buildWhatsAppUrl(whatsappNumber, product, 1, siteUrl);
    window.open(url, "_blank");
  }

  if (disabled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-3 shadow-lg md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{product.name}</p>
          <p className="font-bold text-primary">
            {formatPrice(product.price)}
          </p>
        </div>
        <button
          onClick={handleOrder}
          className="flex items-center gap-2 rounded-lg bg-[hsl(142,70%,45%)] px-6 py-3 font-medium text-white"
        >
          <MessageCircle className="h-5 w-5" />
          Order via WhatsApp
        </button>
      </div>
    </div>
  );
}
