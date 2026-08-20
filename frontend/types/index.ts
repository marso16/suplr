export type Plan = "base" | "pro";

export interface Supplier {
  id: number;
  name: string;
  email: string;
  plan: Plan;
  logo: string | null;
  address: string | null;
  phone: string | null;
  is_admin: boolean;
  suspended: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface OrderItem {
  id: number;
  product_name: string;
  product_name_raw: string;
  product_id: number | null;
  quantity: string;
  unit: string;
  price: string;
  notes: string | null;
}

export type OrderStatus = "pending" | "confirmed" | "fulfilled" | "invoiced";

export interface ClientSummary {
  id: number;
  name: string;
  whatsapp_number: string;
}

export interface Order {
  id: number;
  supplier_id: number;
  client_id: number;
  client: ClientSummary;
  status: OrderStatus;
  currency: string;
  total: string;
  created_at: string;
  confirmed_at: string | null;
  delivery_date: string | null;
  notes: string | null;
  items: OrderItem[];
}

export interface SSEOrderEvent {
  type: "order_created" | "order_updated";
  order_id: number;
}

export interface Invoice {
  id: number;
  supplier_id: number;
  order_id: number;
  number: string;
  currency: string;
  total: string;
  issued_at: string;
  paid_at: string | null;
  client_name: string | null;
}

export interface Client {
  id: number;
  supplier_id: number;
  name: string;
  whatsapp_number: string;
  credit_terms: string | null;
  notes: string | null;
  credit_balance: string;
}

export interface PeriodBucket {
  label: string;
  revenue: string;
  order_count: number;
}

export interface ProductStat {
  name: string;
  revenue: string;
  order_count: number;
}

export interface ClientStat {
  name: string;
  revenue: string;
  order_count: number;
  credit_balance: string;
}

export interface Report {
  period: string;
  revenue: string;
  order_count: number;
  avg_order_value: string;
  buckets: PeriodBucket[];
  top_products: ProductStat[];
  top_clients: ClientStat[];
}

export interface Product {
  id: number;
  supplier_id: number;
  name: string;
  sku: string;
  unit: string;
  price_usd: string | null;
  price_lbp: string | null;
  active: boolean;
}
