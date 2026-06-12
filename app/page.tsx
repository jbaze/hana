"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, ErrorState, EmptyState, Skeleton } from "@/components/ui";
import { RevenueTrendChart, TopGenresChart } from "@/components/charts";
import { formatMoney, formatNumber } from "@/lib/format";
import { t } from "@/lib/strings";
import { DashboardData } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

export default function DashboardPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        setState({ status: "error", message: t.db.hanaUnreachable });
        return;
      }
      const data: DashboardData = await res.json();
      setState({ status: "ready", data });
    } catch {
      setState({ status: "error", message: t.db.hanaUnreachable });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t.dashboard.title}
        </h1>
        <p className="text-slate-500 mt-1">{t.dashboard.subtitle}</p>
      </div>

      {state.status === "error" && (
        <ErrorState message={state.message} onRetry={load} />
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {state.status === "ready"
          ? [
              [t.dashboard.totalBooks, formatNumber(state.data.kpis.totalBooks)],
              [t.dashboard.totalOrders, formatNumber(state.data.kpis.totalOrders)],
              [t.dashboard.revenue, formatMoney(state.data.kpis.totalRevenue)],
              [t.dashboard.customers, formatNumber(state.data.kpis.totalCustomers)],
            ].map(([label, value]) => (
              <Card key={label} className="p-5">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {value}
                </p>
              </Card>
            ))
          : Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32 mt-2" />
              </Card>
            ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title={t.dashboard.topGenres}
            subtitle={t.dashboard.topGenresSubtitle}
          />
          <div className="p-4">
            {state.status === "ready" ? (
              state.data.topGenres.length > 0 ? (
                <TopGenresChart data={state.data.topGenres} />
              ) : (
                <EmptyState />
              )
            ) : (
              <Skeleton className="h-[280px] w-full" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader
            title={t.dashboard.revenueTrend}
            subtitle={t.dashboard.revenueTrendSubtitle}
          />
          <div className="p-4">
            {state.status === "ready" ? (
              state.data.revenueTrend.length > 0 ? (
                <RevenueTrendChart data={state.data.revenueTrend} />
              ) : (
                <EmptyState />
              )
            ) : (
              <Skeleton className="h-[280px] w-full" />
            )}
          </div>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader title={t.dashboard.recentOrders} />
        <div className="p-4 overflow-x-auto">
          {state.status === "ready" ? (
            state.data.recentOrders.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4 font-medium">{t.dashboard.orderId}</th>
                    <th className="py-2 pr-4 font-medium">{t.dashboard.customer}</th>
                    <th className="py-2 pr-4 font-medium">{t.dashboard.city}</th>
                    <th className="py-2 pr-4 font-medium">{t.dashboard.date}</th>
                    <th className="py-2 pr-4 font-medium text-right">
                      {t.dashboard.items}
                    </th>
                    <th className="py-2 font-medium text-right">
                      {t.dashboard.amount}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.recentOrders.map((o) => (
                    <tr
                      key={o.orderId}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2.5 pr-4 tabular-nums text-slate-700">
                        #{o.orderId}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-900 font-medium">
                        {o.customer}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">{o.city ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-slate-600 tabular-nums">
                        {o.orderedAt}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {o.items}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-medium">
                        {formatMoney(o.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState />
            )
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
