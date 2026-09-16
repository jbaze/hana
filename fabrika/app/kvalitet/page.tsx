"use client";

import { useState } from "react";
import {
  Button, Card, CardHeader, EmptyState, ErrorState, Field, inputCls, PageTitle,
  Skeleton, Td, Th,
} from "@/components/ui";
import { apiCall, useData } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/strings";
import { QcHistoryRow, QcPendingRow } from "@/lib/types";

interface QcData {
  pending: QcPendingRow[];
  history: QcHistoryRow[];
}

export default function QualityPage() {
  const { data, error, loading, reload } = useData<QcData>("/api/qc");
  const [forms, setForms] = useState<Record<number, { good: string; defect: string; note: string }>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function formFor(po: QcPendingRow) {
    return forms[po.po_id] ?? { good: String(po.quantity), defect: "0", note: "" };
  }

  async function submit(po: QcPendingRow) {
    const f = formFor(po);
    const good = Number(f.good);
    const defect = Number(f.defect);
    if (good < 0 || defect < 0 || good + defect !== po.quantity) {
      setFormError(t.quality.invalidSplit);
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await apiCall("/api/qc", "POST", {
      po_id: po.po_id,
      good_qty: good,
      defect_qty: defect,
      note: f.note,
    });
    setBusy(false);
    if (!res.ok)
      setFormError(res.error === "INVALID_SPLIT" ? t.quality.invalidSplit : res.error ?? t.common.error);
    await reload();
  }

  return (
    <div className="space-y-5">
      <PageTitle title={t.quality.title} subtitle={t.quality.subtitle} />
      {error && <ErrorState message={t.common.error} onRetry={reload} />}
      {formError && <ErrorState message={formError} />}
      {loading && <Skeleton className="h-64 w-full" />}

      {data && (
        <>
          <Card>
            <CardHeader title={t.quality.pending} />
            <div className="p-4 space-y-3">
              {data.pending.length === 0 ? (
                <EmptyState message={t.quality.noPending} />
              ) : (
                data.pending.map((po) => {
                  const f = formFor(po);
                  return (
                    <div
                      key={po.po_id}
                      className="border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-end gap-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          ПН-{String(po.po_id).padStart(4, "0")} · {po.product_name}{" "}
                          <span className="text-slate-400 text-xs">({po.product_code})</span>
                        </p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {po.customer_name} · {t.quality.produced}: <b>{po.quantity}</b> ·{" "}
                          {t.production.started}: {formatDate(po.started_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <Field label={t.quality.good}>
                          <input
                            type="number"
                            min={0}
                            max={po.quantity}
                            className={`${inputCls} w-24`}
                            value={f.good}
                            onChange={(e) =>
                              setForms({
                                ...forms,
                                [po.po_id]: {
                                  ...f,
                                  good: e.target.value,
                                  defect: String(Math.max(0, po.quantity - Number(e.target.value))),
                                },
                              })
                            }
                          />
                        </Field>
                        <Field label={t.quality.defect}>
                          <input
                            type="number"
                            min={0}
                            max={po.quantity}
                            className={`${inputCls} w-24`}
                            value={f.defect}
                            onChange={(e) =>
                              setForms({
                                ...forms,
                                [po.po_id]: {
                                  ...f,
                                  defect: e.target.value,
                                  good: String(Math.max(0, po.quantity - Number(e.target.value))),
                                },
                              })
                            }
                          />
                        </Field>
                        <Field label={t.quality.note}>
                          <input
                            type="text"
                            className={`${inputCls} w-48`}
                            value={f.note}
                            onChange={(e) =>
                              setForms({ ...forms, [po.po_id]: { ...f, note: e.target.value } })
                            }
                          />
                        </Field>
                        <Button disabled={busy} onClick={() => void submit(po)}>
                          {t.quality.submit}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t.quality.history} />
            <div className="p-4 overflow-x-auto">
              {data.history.length === 0 ? (
                <EmptyState />
              ) : (
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <Th>{t.production.poNumber}</Th>
                      <Th>{t.production.product}</Th>
                      <Th right>{t.quality.produced}</Th>
                      <Th right>{t.quality.good}</Th>
                      <Th right>{t.quality.defect}</Th>
                      <Th right>{t.quality.defectPercent}</Th>
                      <Th>{t.quality.note}</Th>
                      <Th>{t.common.date}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((qc) => (
                      <tr key={qc.qc_id} className="border-b border-slate-100 last:border-0">
                        <Td className="tabular-nums text-slate-500">
                          ПН-{String(qc.po_id).padStart(4, "0")}
                        </Td>
                        <Td className="font-medium">{qc.product_name}</Td>
                        <Td right>{qc.checked_qty}</Td>
                        <Td right className="text-emerald-700">{qc.good_qty}</Td>
                        <Td right className={qc.defect_qty > 0 ? "text-amber-700" : ""}>
                          {qc.defect_qty}
                        </Td>
                        <Td right>
                          {((qc.defect_qty / qc.checked_qty) * 100).toFixed(1)}%
                        </Td>
                        <Td className="text-slate-500 text-xs">{qc.note ?? "—"}</Td>
                        <Td>{formatDate(qc.checked_at)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
