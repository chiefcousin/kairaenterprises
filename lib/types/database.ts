export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  stock_quantity: number;
  category_id: string | null;
  brand: string | null;
  age_range: string | null;
  tags: string[];
  is_featured: boolean;
  is_active: boolean;
  video_url: string | null;
  created_at: string;
  updated_at: string;
  cost_price: number;
  low_stock_threshold: number;
  // Zoho Inventory integration
  zoho_item_id: string | null;
  last_synced_from_zoho: string | null;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface WhatsAppOrder {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  customer_phone: string | null;
  status: "clicked" | "confirmed" | "fulfilled" | "cancelled";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  // Zoho Inventory integration
  zoho_sales_order_id: string | null;
  zoho_sync_error: string | null;
  zoho_synced_at: string | null;
}

export interface ProductView {
  id: string;
  product_id: string;
  viewed_at: string;
}

export interface StoreSetting {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  business_name: string | null;
  address: string | null;
  password_hash: string | null;
  approval_status: ApprovalStatus;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminNotification {
  id: string;
  type: 'signup_request' | 'order' | 'stock_alert' | 'general';
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'partner' | 'staff';
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  customer_phone: string;
  customer_name: string;
  rating: number;
  title: string | null;
  review: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'return'
  | 'damage'
  | 'sync_zoho'
  | 'sync_local'
  | 'initial';

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StockMovementWithProduct extends StockMovement {
  product_name: string;
  product_sku: string | null;
}

export interface InventorySummary {
  total_products: number;
  total_stock_value: number;
  total_cost_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_units: number;
}

// Extended types with joins
export interface ProductWithImages extends Product {
  product_images: ProductImage[];
  categories: Category | null;
}

export interface ProductWithPrimaryImage extends Product {
  product_images: Pick<ProductImage, "url" | "alt_text">[];
  categories: Pick<Category, "name" | "slug"> | null;
}

export interface WhatsAppOrderWithProduct extends WhatsAppOrder {
  products: Pick<Product, "name" | "slug"> | null;
}
