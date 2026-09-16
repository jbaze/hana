/** Shared types between API routes and client pages. */

export interface Customer {
  customer_id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  orders_count: number;
}

export interface Material {
  material_id: number;
  name: string;
  unit: string;
  unit_price: number;
  stock: number;
  min_stock: number;
}

export interface BomLine {
  material_id: number;
  name: string;
  unit: string;
  unit_price: number;
  quantity: number;
}

export interface Product {
  product_id: number;
  code: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  bom: BomLine[];
  material_cost: number;
}

export interface MaterialCheckLine {
  materialId: number;
  name: string;
  unit: string;
  required: number;
  available: number;
  missing: number;
}

export interface OrderRow {
  order_id: number;
  customer_id: number;
  customer_name: string;
  product_id: number;
  product_code: string;
  product_name: string;
  product_price: number;
  quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
  /** Present only for NEW orders: BOM availability check. */
  material_check?: MaterialCheckLine[];
  /** Present only for READY orders: finished goods available. */
  finished_stock?: number;
}

export interface ProductionRow {
  po_id: number;
  order_id: number;
  customer_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  good_qty: number | null;
  defect_qty: number | null;
}

export interface QcPendingRow {
  po_id: number;
  order_id: number;
  customer_name: string;
  product_name: string;
  product_code: string;
  quantity: number;
  started_at: string;
}

export interface QcHistoryRow {
  qc_id: number;
  po_id: number;
  product_name: string;
  checked_qty: number;
  good_qty: number;
  defect_qty: number;
  note: string | null;
  checked_at: string;
}

export interface MovementRow {
  movement_id: number;
  item_type: string;
  item_name: string;
  change: number;
  unit: string;
  reason: string;
  created_at: string;
}

export interface DashboardData {
  kpis: {
    activeOrders: number;
    inProduction: number;
    lowStockCount: number;
    deliveredThisMonth: number;
    defectRate: number;
    finishedGoods: number;
  };
  ordersByStatus: { status: string; count: number }[];
  monthlyOrders: { month: string; count: number }[];
  lowStock: { name: string; unit: string; stock: number; min_stock: number }[];
  recentOrders: OrderRow[];
}

export interface ReportsData {
  monthlyProduction: { month: string; good: number; defect: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
  defectByProduct: { name: string; produced: number; defect: number; rate: number }[];
  topProducts: { name: string; ordered: number }[];
  topCustomers: { name: string; orders: number }[];
  stockValue: { materials: number; products: number };
}
