import { NextResponse } from "next/server";
import { withHana } from "@/lib/db/hana";
import { DashboardData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live KPIs and charts for the home page, queried from SAP HANA. */
export async function GET() {
  try {
    const data = await withHana(async (conn) => {
      const [kpiRow] = await conn.exec<{
        TOTAL_BOOKS: number;
        TOTAL_ORDERS: number;
        TOTAL_CUSTOMERS: number;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM books) AS TOTAL_BOOKS,
           (SELECT COUNT(*) FROM orders) AS TOTAL_ORDERS,
           (SELECT COUNT(*) FROM customers) AS TOTAL_CUSTOMERS
         FROM DUMMY`
      );
      const [revRow] = await conn.exec<{ TOTAL_REVENUE: number }>(
        `SELECT COALESCE(SUM(quantity * unit_price), 0) AS TOTAL_REVENUE FROM order_items`
      );

      const topGenres = await conn.exec<{ GENRE: string; SOLD: number }>(
        `SELECT b.genre AS GENRE, SUM(oi.quantity) AS SOLD
         FROM order_items oi
         JOIN books b ON b.book_id = oi.book_id
         GROUP BY b.genre
         ORDER BY SOLD DESC
         LIMIT 8`
      );

      const revenueTrend = await conn.exec<{ MONTH: string; REVENUE: number }>(
        `SELECT TO_VARCHAR(o.ordered_at, 'YYYY-MM') AS MONTH,
                SUM(oi.quantity * oi.unit_price) AS REVENUE
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.order_id
         GROUP BY TO_VARCHAR(o.ordered_at, 'YYYY-MM')
         ORDER BY MONTH`
      );

      const recentOrders = await conn.exec<{
        ORDER_ID: number;
        CUSTOMER: string;
        CITY: string | null;
        ORDERED_AT: string;
        ITEMS: number;
        AMOUNT: number;
      }>(
        `SELECT o.order_id AS ORDER_ID, c.name AS CUSTOMER, c.city AS CITY,
                TO_VARCHAR(o.ordered_at, 'YYYY-MM-DD HH24:MI') AS ORDERED_AT,
                COUNT(oi.order_item_id) AS ITEMS,
                SUM(oi.quantity * oi.unit_price) AS AMOUNT
         FROM orders o
         JOIN customers c ON c.customer_id = o.customer_id
         JOIN order_items oi ON oi.order_id = o.order_id
         GROUP BY o.order_id, c.name, c.city, o.ordered_at
         ORDER BY o.ordered_at DESC
         LIMIT 8`
      );

      const payload: DashboardData = {
        kpis: {
          totalBooks: Number(kpiRow.TOTAL_BOOKS),
          totalOrders: Number(kpiRow.TOTAL_ORDERS),
          totalRevenue: Number(revRow.TOTAL_REVENUE),
          totalCustomers: Number(kpiRow.TOTAL_CUSTOMERS),
        },
        topGenres: topGenres.map((r) => ({
          genre: r.GENRE,
          sold: Number(r.SOLD),
        })),
        revenueTrend: revenueTrend.map((r) => ({
          month: r.MONTH,
          revenue: Number(r.REVENUE),
        })),
        recentOrders: recentOrders.map((r) => ({
          orderId: Number(r.ORDER_ID),
          customer: r.CUSTOMER,
          city: r.CITY,
          orderedAt: r.ORDERED_AT,
          items: Number(r.ITEMS),
          amount: Number(r.AMOUNT),
        })),
      };
      return payload;
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
