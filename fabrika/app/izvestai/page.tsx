"use client";

import { Card, CardHeader, ErrorState, PageTitle, Skeleton, Td, Th } from "@/components/ui";
import {
  HorizontalBars, ProductionChart, RevenueLineChart,
} from "@/components/charts";
import { useData } from "@/lib/client";
import { formatMoney, formatNumber } from "@/lib/format";
import { t } from "@/lib/strings";
import { ReportsData } from "@/lib/types";

export default function ReportsPage() {
  const { data, error, loading, reload } = useData<ReportsData>("/api/reports");

  return (
    <div className="space-y-5">
      <PageTitle title={t.reports.title} subtitle={t.reports.subtitle} />
      {error && <ErrorState message={t.common.error} onRetry={reload} />}
      {loading && <Skeleton className="h-64 w-full" />}

      {data && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-5">
              <p className="text-sm text-slate-500">
                {t.reports.stockValueTitle} — {t.reports.materialsValue}
              </p>
              <p className="text-2xl font-bold tabular-nums mt-1">
                {formatMoney(data.stockValue.materials)}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-slate-500">
                {t.reports.stockValueTitle} — {t.reports.productsValue}
              </p>
              <p className="text-2xl font-bold tabular-nums mt-1">
                {formatMoney(data.stockValue.products)}
              </p>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title={t.reports.monthlyProduction} />
              <div className="p-4">
                <ProductionChart
                  data={data.monthlyProduction}
                  goodLabel={t.reports.unitsGood}
                  defectLabel={t.reports.unitsDefect}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title={t.reports.monthlyRevenue} />
              <div className="p-4">
                <RevenueLineChart data={data.monthlyRevenue} name={t.orders.valueTotal} />
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title={t.reports.topProducts} />
              <div className="p-4">
                <HorizontalBars
                  data={data.topProducts}
                  nameKey="name"
                  valueKey="ordered"
                  label={t.common.quantity}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title={t.reports.topCustomers} />
              <div className="p-4">
                <HorizontalBars
                  data={data.topCustomers}
                  nameKey="name"
                  valueKey="orders"
                  label={t.customers.ordersCount}
                />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title={t.reports.defectByProduct} />
            <div className="p-4 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <Th>{t.products.name}</Th>
                    <Th right>{t.quality.produced}</Th>
                    <Th right>{t.quality.defect}</Th>
                    <Th right>{t.quality.defectPercent}</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.defectByProduct.map((r) => (
                    <tr key={r.name} className="border-b border-slate-100 last:border-0">
                      <Td className="font-medium">{r.name}</Td>
                      <Td right>{formatNumber(r.produced)}</Td>
                      <Td right className={r.defect > 0 ? "text-amber-700" : ""}>
                        {formatNumber(r.defect)}
                      </Td>
                      <Td right>{r.rate}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
