import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ReportsData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const monthlyProduction = db
    .prepare(
      `SELECT strftime('%Y-%m', checked_at) AS month,
              SUM(good_qty) AS good, SUM(defect_qty) AS defect
       FROM quality_checks GROUP BY month ORDER BY month`
    )
    .all() as ReportsData["monthlyProduction"];

  // Value of delivered orders per month (price x ordered quantity).
  const monthlyRevenue = db
    .prepare(
      `SELECT strftime('%Y-%m', o.updated_at) AS month,
              SUM(o.quantity * p.price) AS revenue
       FROM orders o JOIN products p ON p.product_id = o.product_id
       WHERE o.status = 'DELIVERED'
       GROUP BY month ORDER BY month`
    )
    .all() as ReportsData["monthlyRevenue"];

  const defectByProduct = (
    db
      .prepare(
        `SELECT p.name, SUM(qc.checked_qty) AS produced, SUM(qc.defect_qty) AS defect
         FROM quality_checks qc
         JOIN production_orders po ON po.po_id = qc.po_id
         JOIN products p ON p.product_id = po.product_id
         GROUP BY p.product_id ORDER BY p.code`
      )
      .all() as { name: string; produced: number; defect: number }[]
  ).map((r) => ({
    ...r,
    rate: r.produced > 0 ? Math.round((r.defect / r.produced) * 1000) / 10 : 0,
  }));

  const topProducts = db
    .prepare(
      `SELECT p.name, SUM(o.quantity) AS ordered
       FROM orders o JOIN products p ON p.product_id = o.product_id
       GROUP BY p.product_id ORDER BY ordered DESC LIMIT 8`
    )
    .all() as ReportsData["topProducts"];

  const topCustomers = db
    .prepare(
      `SELECT c.name, COUNT(*) AS orders
       FROM orders o JOIN customers c ON c.customer_id = o.customer_id
       GROUP BY c.customer_id ORDER BY orders DESC LIMIT 8`
    )
    .all() as ReportsData["topCustomers"];

  const stockValue = {
    materials: (
      db.prepare(`SELECT COALESCE(ROUND(SUM(stock * unit_price)),0) v FROM materials`).get() as { v: number }
    ).v,
    products: (
      db.prepare(`SELECT COALESCE(ROUND(SUM(stock * price)),0) v FROM products`).get() as { v: number }
    ).v,
  };

  const data: ReportsData = {
    monthlyProduction,
    monthlyRevenue,
    defectByProduct,
    topProducts,
    topCustomers,
    stockValue,
  };
  return NextResponse.json(data);
}
