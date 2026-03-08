export function buildWhatsAppUrl(
  phone: string,
  product: { name: string; price: number; slug: string },
  quantity: number,
  siteUrl: string
): string {
  const productUrl = `${siteUrl}/products/${product.slug}`;
  const message = [
    `Hi! I'd like to order:`,
    ``,
    `*${product.name}*`,
    `Price: ${formatPrice(product.price)}`,
    `Quantity: ${quantity}`,
    ``,
    `Product link: ${productUrl}`,
  ].join("\n");

  const encoded = encodeURIComponent(message);
  const cleanPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(price);
}
