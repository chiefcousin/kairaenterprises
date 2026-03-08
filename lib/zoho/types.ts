// Zoho Inventory API type definitions

export interface ZohoCustomField {
  customfield_id: string;
  label: string;
  value: string | number | null;
}

export interface ZohoTag {
  tag_id: string;
  tag_option_name: string;
}

// Shape of a Zoho Inventory item (from GET /items or GET /items/:id)
export interface ZohoItem {
  item_id: string;
  name: string;
  description: string | null;
  rate: number; // selling price
  purchase_rate: number;
  sku: string | null;
  // Use actual_available_stock for physical on-hand count
  actual_available_stock: number;
  available_for_sale_stock: number;
  status: "active" | "inactive";
  custom_fields?: ZohoCustomField[];
  image_document_id?: string;
  tags?: ZohoTag[];
  // Item group name from Zoho — used for auto-categorization
  group_name?: string;
  category_name?: string;
}

export interface ZohoItemsResponse {
  code: number;
  message: string;
  items: ZohoItem[];
  page_context?: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
  };
}

export interface ZohoItemResponse {
  code: number;
  message: string;
  item: ZohoItem;
}

// Sales order types
export interface ZohoSalesOrderLineItem {
  item_id?: string; // include if item exists in Zoho for stock tracking
  name: string;
  description?: string;
  rate: number;
  quantity: number;
  unit?: string;
}

export interface ZohoCreateSalesOrderPayload {
  customer_name: string;
  reference_number?: string; // Kaira Enterprises whatsapp_orders.id for traceability
  line_items: ZohoSalesOrderLineItem[];
  notes?: string;
}

export interface ZohoCreateSalesOrderResponse {
  code: number;
  message: string;
  salesorder?: {
    salesorder_id: string;
    salesorder_number: string;
    status: string;
  };
}

// Webhook payload shape when Zoho sends item events
export interface ZohoWebhookPayload {
  event_type: "item_created" | "item_updated" | "item_deleted";
  organization_id: string;
  data: {
    item: ZohoItem;
  };
}

// Result returned from a full product sync
export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  categorized?: number;
  categories_created?: number;
  categories_deleted?: number;
  errors: string[];
}
