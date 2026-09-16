import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api";
import { finishProduction } from "@/lib/flow";
import { ProductionRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT po.po_id, po.order_id, c.name AS customer_name,
              p.code AS product_code, p.name AS product_name,
              po.quantity, po.status, po.started_at, po.completed_at,
              qc.good_qty, qc.defect_qty
       FROM production_orders po
       JOIN orders o ON o.order_id = po.order_id
       JOIN customers c ON c.customer_id = o.customer_id
       JOIN products p ON p.product_id = po.product_id
       LEFT JOIN quality_checks qc ON qc.po_id = po.po_id
       ORDER BY po.po_id DESC
       LIMIT 100`
    )
    .all() as ProductionRow[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (b.action === "finish") {
      finishProduction(Number(b.po_id));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return apiError(err);
  }
}
