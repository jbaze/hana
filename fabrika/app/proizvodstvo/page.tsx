"use client";

import { useState } from "react";
import {
  Button, Card, EmptyState, ErrorState, PageTitle, Skeleton, StatusBadge, Td, Th,
} from "@/components/ui";
import { apiCall, useData } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/strings";
import { ProductionRow } from "@/lib/types";

export default function ProductionPage() {
  const { data, error, loading, reload } = useData<ProductionRow[]>("/api/production");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function finish(poId: number) {
    setBusy(true);
    setActionError(null);
    const res = await apiCall("/api/production", "POST", { action: "finish", po_id: poId });
    setBusy(false);
    if (!res.ok) setActionError(res.error ?? t.common.error);
    await reload();
  }

  return (
    <div className="space-y-5">
      <PageTitle title={t.production.title} subtitle={t.production.subtitle} />
      {error && <ErrorState message={t.common.error} onRetry={reload} />}
      {actionError && <ErrorState message={actionError} />}
      {loading && <Skeleton className="h-64 w-full" />}

      {data && (
        <Card>
          <div className="p-4 overflow-x-auto">
            {data.length === 0 ? (
              <EmptyState message={t.production.empty} />
            ) : (
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <Th>{t.production.poNumber}</Th>
                    <Th>{t.production.order}</Th>
                    <Th>{t.orders.customer}</Th>
                    <Th>{t.production.product}</Th>
                    <Th right>{t.common.quantity}</Th>
                    <Th right>{t.quality.good}</Th>
                    <Th right>{t.quality.defect}</Th>
                    <Th>{t.production.started}</Th>
                    <Th>{t.common.status}</Th>
                    <Th right>{t.common.actions}</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((po) => (
                    <tr key={po.po_id} className="border-b border-slate-100 last:border-0">
                      <Td className="tabular-nums text-slate-500">
                        ПН-{String(po.po_id).padStart(4, "0")}
                      </Td>
                      <Td className="tabular-nums text-slate-500">
                        #{String(po.order_id).padStart(5, "0")}
                      </Td>
                      <Td className="font-medium">{po.customer_name}</Td>
                      <Td>
                        {po.product_name}{" "}
                        <span className="text-slate-400 text-xs">({po.product_code})</span>
                      </Td>
                      <Td right>{po.quantity}</Td>
                      <Td right className="text-emerald-700">
                        {po.good_qty ?? "—"}
                      </Td>
                      <Td right className={po.defect_qty ? "text-amber-700" : ""}>
                        {po.defect_qty ?? "—"}
                      </Td>
                      <Td>{formatDate(po.started_at)}</Td>
                      <Td>
                        <StatusBadge status={po.status} labels={t.poStatus} />
                      </Td>
                      <Td right>
                        {po.status === "OPEN" && (
                          <Button small disabled={busy} onClick={() => void finish(po.po_id)}>
                            {t.production.finish}
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="px-5 pb-4 text-xs text-slate-500">{t.production.finishHint}</p>
        </Card>
      )}
    </div>
  );
}
