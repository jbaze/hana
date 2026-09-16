import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api";
import {
  createOrder,
  deliverOrder,
  materialRequirements,
  startProduction,
} from "@/lib/flow";
import { OrderRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT o.order_id, o.customer_id, c.name AS customer_name,
              o.product_id, p.code AS product_code, p.name AS product_name,
              p.price AS product_price, p.stock AS finished_stock,
              o.quantity, o.status, o.created_at, o.updated_at
       FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       JOIN products p ON p.product_id = o.product_id
       ORDER BY o.order_id DESC
       LIMIT 200`
    )
    .all() as (OrderRow & { finished_stock: number })[];
  // Attach the live BOM availability check to orders awaiting production.
  const withCheck = rows.map((r) =>
    r.status === "NEW"
      ? { ...r, material_check: materialRequirements(r.product_id, r.quantity) }
      : r
  );
  return NextResponse.json(withCheck);
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();

    if (b.action === "start") {
      const poId = startProduction(Number(b.order_id));
      return NextResponse.json({ ok: true, po_id: poId });
    }
    if (b.action === "deliver") {
      deliverOrder(Number(b.order_id));
      return NextResponse.json({ ok: true });
    }

    // Default action: create a new order.
    const orderId = createOrder(
      Number(b.customer_id),
      Number(b.product_id),
      Number(b.quantity)
    );
    return NextResponse.json({ order_id: orderId });
  } catch (err) {
    return apiError(err);
  }
}
