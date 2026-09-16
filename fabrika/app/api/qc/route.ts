import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api";
import { recordQualityCheck } from "@/lib/flow";
import { QcHistoryRow, QcPendingRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const pending = db
    .prepare(
      `SELECT po.po_id, po.order_id, c.name AS customer_name,
              p.name AS product_name, p.code AS product_code,
              po.quantity, po.started_at
       FROM production_orders po
       JOIN orders o ON o.order_id = po.order_id
       JOIN customers c ON c.customer_id = o.customer_id
       JOIN products p ON p.product_id = po.product_id
       WHERE po.status = 'WAITING_QC'
       ORDER BY po.po_id`
    )
    .all() as QcPendingRow[];
  const history = db
    .prepare(
      `SELECT qc.qc_id, qc.po_id, p.name AS product_name,
              qc.checked_qty, qc.good_qty, qc.defect_qty, qc.note, qc.checked_at
       FROM quality_checks qc
       JOIN production_orders po ON po.po_id = qc.po_id
       JOIN products p ON p.product_id = po.product_id
       ORDER BY qc.qc_id DESC
       LIMIT 25`
    )
    .all() as QcHistoryRow[];
  return NextResponse.json({ pending, history });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    recordQualityCheck(
      Number(b.po_id),
      Number(b.good_qty),
      Number(b.defect_qty),
      b.note?.trim() || null
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
