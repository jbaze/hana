"use client";

import { Card, CardHeader, EmptyState, ErrorState, PageTitle, Skeleton, StatusBadge, Td, Th } from "@/components/ui";
import { MonthlyBarChart } from "@/components/charts";
import { useData } from "@/lib/client";
import { formatDate, formatNumber, formatQty } from "@/lib/format";
import { t } from "@/lib/strings";
import { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const { data, error, loading, reload } = useData<DashboardData>("/api/dashboard");

  const kpis = data
    ? ([
        [t.dashboard.activeOrders, formatNumber(data.kpis.activeOrders)],
        [t.dashboard.inProduction, formatNumber(data.kpis.inProduction)],
        [t.dashboard.finishedGoods, formatNumber(data.kpis.finishedGoods)],
        [t.dashboard.deliveredThisMonth, formatNumber(data.kpis.deliveredThisMonth)],
        [t.dashboard.defectRate, `${data.kpis.defectRate}%`],
        [t.dashboard.lowStock, formatNumber(data.kpis.lowStockCount)],
      ] as [string, string][])
    : null;

  return (
    <div className="space-y-5">
      <PageTitle title={t.dashboard.title} subtitle={t.dashboard.subtitle} />

      {error && <ErrorState message={t.common.error} onRetry={reload} />}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis
          ? kpis.map(([label, value], i) => (
              <Card key={label} className="p-4">
                <p className="text-xs text-slate-500 leading-tight">{label}</p>
                <p
                  className={`text-2xl font-bold mt-1 tabular-nums ${
                    i === 5 && data!.kpis.lowStockCount > 0 ? "text-amber-600" : "text-slate-900"
                  }`}
                >
                  {value}
                </p>
              </Card>
            ))
          : Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-14 mt-2" />
              </Card>
            ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title={t.dashboard.monthlyOrders} />
          <div className="p-4">
            {data ? (
              <MonthlyBarChart data={data.monthlyOrders} dataKey="count" name={t.nav.orders} />
            ) : (
              <Skeleton className="h-[260px] w-full" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t.dashboard.lowStockTitle} />
          <div className="p-4">
            {loading && <Skeleton className="h-[260px] w-full" />}
            {data &&
              (data.lowStock.length === 0 ? (
                <EmptyState message={t.dashboard.lowStockOk} />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <Th>{t.dashboard.material}</Th>
                      <Th right>{t.dashboard.available}</Th>
                      <Th right>{t.dashboard.minimum}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowStock.map((m) => (
                      <tr key={m.name} className="border-b border-slate-100 last:border-0">
                        <Td>{m.name}</Td>
                        <Td right className="text-amber-700 font-semibold">
                          {formatQty(m.stock)} {m.unit}
                        </Td>
                        <Td right>
                          {formatQty(m.min_stock)} {m.unit}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={t.dashboard.recentOrders} />
        <div className="p-4 overflow-x-auto">
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          )}
          {data && (
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>{t.orders.number}</Th>
                  <Th>{t.orders.customer}</Th>
                  <Th>{t.orders.product}</Th>
                  <Th right>{t.common.quantity}</Th>
                  <Th>{t.common.date}</Th>
                  <Th>{t.common.status}</Th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.order_id} className="border-b border-slate-100 last:border-0">
                    <Td className="tabular-nums text-slate-500">#{String(o.order_id).padStart(5, "0")}</Td>
                    <Td className="font-medium">{o.customer_name}</Td>
                    <Td>
                      {o.product_name}{" "}
                      <span className="text-slate-400 text-xs">({o.product_code})</span>
                    </Td>
                    <Td right>{o.quantity}</Td>
                    <Td>{formatDate(o.created_at)}</Td>
                    <Td>
                      <StatusBadge status={o.status} labels={t.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
