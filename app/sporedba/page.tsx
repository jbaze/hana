"use client";

import { useState } from "react";
import { Card, CardHeader, ErrorState, Skeleton } from "@/components/ui";
import { CompareChart, ComparePoint } from "@/components/charts";
import { formatMs, formatNumber } from "@/lib/format";
import { queries } from "@/lib/queries";
import { t } from "@/lib/strings";
import { BenchmarkResult, DbOutcome } from "@/lib/types";

async function callBenchmark(
  queryId: string,
  runs: number
): Promise<BenchmarkResult> {
  const res = await fetch("/api/benchmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queryId, runs }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function conclusionSentence(result: BenchmarkResult): string | null {
  if (!result.hana.ok || !result.postgres.ok) return null;
  const h = result.hana.medianMs;
  const p = result.postgres.medianMs;
  if (h <= 0 || p <= 0) return null;
  const ratio = h < p ? p / h : h / p;
  if (ratio < 1.15) return t.compare.tie;
  const winner = h < p ? t.db.hana : t.db.postgres;
  return t.compare.speedup(ratio.toFixed(1), winner);
}

function SqlBlock({ label, sql }: { label: string; sql: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
      <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto leading-relaxed">
        <code>{sql}</code>
      </pre>
    </div>
  );
}

function OutcomeCells({ outcome }: { outcome: DbOutcome }) {
  if (!outcome.ok) {
    return (
      <td colSpan={6} className="py-2.5 text-sm text-red-600">
        {t.common.notAvailable}
      </td>
    );
  }
  return (
    <>
      <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">
        {formatMs(outcome.medianMs)}
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        {formatMs(outcome.meanMs)}
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        {formatMs(outcome.minMs)}
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        {formatMs(outcome.maxMs)}
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        {outcome.engineMs !== null ? formatMs(outcome.engineMs) : "—"}
      </td>
      <td className="py-2.5 text-right tabular-nums">
        {formatNumber(outcome.rowCount)}
      </td>
    </>
  );
}

export default function ComparePage() {
  const [queryId, setQueryId] = useState(queries[0].id);
  const [runs, setRuns] = useState(5);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [allResults, setAllResults] = useState<BenchmarkResult[] | null>(null);
  const [fatalError, setFatalError] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const selected = queries.find((q) => q.id === queryId)!;
  const resultQuery = result ? queries.find((q) => q.id === result.queryId) : null;

  async function runOne() {
    setRunning(true);
    setFatalError(false);
    setAllResults(null);
    setResult(null);
    setProgress(t.compare.runningQuery(selected.title));
    try {
      setResult(await callBenchmark(queryId, runs));
    } catch {
      setFatalError(true);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  async function runAll() {
    setRunning(true);
    setFatalError(false);
    setResult(null);
    setAllResults(null);
    const collected: BenchmarkResult[] = [];
    try {
      for (const q of queries) {
        setProgress(t.compare.runningQuery(q.title));
        collected.push(await callBenchmark(q.id, runs));
        setAllResults([...collected]);
      }
    } catch {
      setFatalError(true);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  const singleChart: ComparePoint[] | null = result
    ? [
        {
          name: resultQuery?.title ?? result.queryId,
          hana: result.hana.ok ? result.hana.medianMs : null,
          postgres: result.postgres.ok ? result.postgres.medianMs : null,
        },
      ]
    : null;

  const summaryChart: ComparePoint[] | null = allResults
    ? allResults.map((r) => {
        const q = queries.find((x) => x.id === r.queryId);
        return {
          name: q?.title ?? r.queryId,
          hana: r.hana.ok ? r.hana.medianMs : null,
          postgres: r.postgres.ok ? r.postgres.medianMs : null,
        };
      })
    : null;

  const conclusion = result ? conclusionSentence(result) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t.compare.title}
        </h1>
        <p className="text-slate-500 mt-1 max-w-3xl">{t.compare.subtitle}</p>
      </div>

      {/* Controls */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
          <label className="flex-1 block">
            <span className="text-sm font-medium text-slate-700">
              {t.compare.selectQuery}
            </span>
            <select
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              disabled={running}
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {queries.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} (
                  {q.category === "analytical"
                    ? t.compare.categoryAnalytical
                    : t.compare.categoryTransactional}
                  )
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              {t.compare.runs}
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={runs}
              onChange={(e) =>
                setRuns(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
              }
              disabled={running}
              className="mt-1.5 w-full lg:w-28 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => void runOne()}
              disabled={running}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {running ? t.compare.running : t.compare.run}
            </button>
            <button
              onClick={() => void runAll()}
              disabled={running}
              className="px-5 py-2.5 rounded-lg border border-indigo-300 text-indigo-700 bg-indigo-50 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              {t.compare.runAll}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">{t.compare.warmupNote}</p>
      </Card>

      {progress && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <span className="text-sm text-slate-700">{progress}</span>
          </div>
          <Skeleton className="h-2 w-full mt-4" />
        </Card>
      )}

      {fatalError && (
        <ErrorState message={t.common.error} onRetry={() => void runOne()} />
      )}

      {/* Single-query result */}
      {result && resultQuery && singleChart && (
        <div className="space-y-4">
          {!result.hana.ok && (
            <ErrorState message={`${t.compare.partialError(t.db.hana)} ${t.db.hanaUnreachable}`} />
          )}
          {!result.postgres.ok && (
            <ErrorState message={`${t.compare.partialError(t.db.postgres)} ${t.db.postgresUnreachable}`} />
          )}

          {(result.hana.ok || result.postgres.ok) && (
            <>
              <Card>
                <CardHeader
                  title={resultQuery.title}
                  subtitle={`${t.compare.medianTime} · ${result.runs}× ${t.compare.runs.toLowerCase()}`}
                />
                <div className="p-4">
                  <CompareChart data={singleChart} height={260} />
                </div>
                {conclusion && (
                  <p className="px-5 pb-3 text-sm font-medium text-slate-800">
                    {conclusion}
                  </p>
                )}
                <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
                  {resultQuery.explanation}
                </p>
              </Card>

              <Card>
                <div className="p-5 overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-4 text-left font-medium"> </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          {t.compare.medianTime}
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          {t.compare.meanTime}
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          {t.compare.minTime}
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          {t.compare.maxTime}
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          {t.compare.engineTime}
                        </th>
                        <th className="py-2 text-right font-medium">
                          {t.compare.rowCount}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-2.5 pr-4 font-semibold text-indigo-700">
                          {t.db.hana}
                        </td>
                        <OutcomeCells outcome={result.hana} />
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-semibold text-teal-700">
                          {t.db.postgres}
                        </td>
                        <OutcomeCells outcome={result.postgres} />
                      </tr>
                    </tbody>
                  </table>
                  {(result.hana.ok || result.postgres.ok) && (
                    <div className="mt-4 space-y-1 text-xs text-slate-500 tabular-nums">
                      {result.hana.ok && (
                        <p>
                          {t.db.hana} — {t.compare.allRuns}:{" "}
                          {result.hana.timingsMs.map((v) => v.toFixed(1)).join(", ")}
                        </p>
                      )}
                      {result.postgres.ok && (
                        <p>
                          {t.db.postgres} — {t.compare.allRuns}:{" "}
                          {result.postgres.timingsMs.map((v) => v.toFixed(1)).join(", ")}
                        </p>
                      )}
                      <p className="pt-2 leading-relaxed">{t.compare.methodNote}</p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-5">
                <button
                  onClick={() => setShowSql((v) => !v)}
                  className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
                >
                  {showSql ? t.compare.hideSql : t.compare.showSql}
                </button>
                {showSql && (
                  <div className="mt-4 grid lg:grid-cols-2 gap-4">
                    <SqlBlock label={t.compare.sqlHana} sql={resultQuery.sqlHana} />
                    <SqlBlock
                      label={t.compare.sqlPostgres}
                      sql={resultQuery.sqlPostgres}
                    />
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* Run-all summary */}
      {summaryChart && summaryChart.length > 0 && (
        <Card>
          <CardHeader
            title={t.compare.summaryTitle}
            subtitle={t.compare.summarySubtitle}
          />
          <div className="p-4">
            <CompareChart data={summaryChart} height={380} />
          </div>
          <div className="px-5 pb-5 overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 text-left font-medium"> </th>
                  <th className="py-2 pr-4 text-left font-medium">
                    {t.compare.category}
                  </th>
                  <th className="py-2 pr-4 text-right font-medium text-indigo-700">
                    {t.db.hana}
                  </th>
                  <th className="py-2 text-right font-medium text-teal-700">
                    {t.db.postgres}
                  </th>
                </tr>
              </thead>
              <tbody>
                {allResults!.map((r) => {
                  const q = queries.find((x) => x.id === r.queryId);
                  return (
                    <tr key={r.queryId} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 text-slate-900">{q?.title}</td>
                      <td className="py-2.5 pr-4 text-slate-500">
                        {q?.category === "analytical"
                          ? t.compare.categoryAnalytical
                          : t.compare.categoryTransactional}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {r.hana.ok ? formatMs(r.hana.medianMs) : t.common.notAvailable}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {r.postgres.ok
                          ? formatMs(r.postgres.medianMs)
                          : t.common.notAvailable}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="pt-4 text-xs text-slate-500 leading-relaxed">
              {t.compare.methodNote}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
