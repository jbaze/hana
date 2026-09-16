import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { DashboardData, OrderRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const activeOrders = (
    db.prepare(`SELECT COUNT(*) c FROM orders WHERE status != 'DELIVERED'`).get() as { c: number }
  ).c;
  const inProduction = (
    db.prepare(`SELECT COUNT(*) c FROM production_orders WHERE status = 'OPEN'`).get() as { c: number }
  ).c;
  const lowStock = db
    .prepare(
      `SELECT name, unit, stock, min_stock FROM materials WHERE stock < min_stock ORDER BY stock / min_stock`
    )
    .all() as DashboardData["lowStock"];
  const deliveredThisMonth = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM orders
         WHERE status = 'DELIVERED' AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')`
      )
      .get() as { c: number }
  ).c;
  const qc = db
    .prepare(`SELECT COALESCE(SUM(good_qty),0) g, COALESCE(SUM(defect_qty),0) d FROM quality_checks`)
    .get() as { g: number; d: number };
  const finishedGoods = (
    db.prepare(`SELECT COALESCE(SUM(stock),0) s FROM products`).get() as { s: number }
  ).s;

  const ordersByStatus = db
    .prepare(`SELECT status, COUNT(*) AS count FROM orders GROUP BY status`)
    .all() as DashboardData["ordersByStatus"];

  const monthlyOrders = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
       FROM orders GROUP BY month ORDER BY month DESC LIMIT 12`
    )
    .all()
    .reverse() as DashboardData["monthlyOrders"];

  const recentOrders = db
    .prepare(
      `SELECT o.order_id, o.customer_id, c.name AS customer_name,
              o.product_id, p.code AS product_code, p.name AS product_name,
              p.price AS product_price, o.quantity, o.status, o.created_at, o.updated_at
       FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       JOIN products p ON p.product_id = o.product_id
       ORDER BY o.order_id DESC LIMIT 8`
    )
    .all() as OrderRow[];

  const data: DashboardData = {
    kpis: {
      activeOrders,
      inProduction,
      lowStockCount: lowStock.length,
      deliveredThisMonth,
      defectRate:
        qc.g + qc.d > 0 ? Math.round((qc.d / (qc.g + qc.d)) * 1000) / 10 : 0,
      finishedGoods,
    },
    ordersByStatus,
    monthlyOrders,
    lowStock,
    recentOrders,
  };
  return NextResponse.json(data);
}
