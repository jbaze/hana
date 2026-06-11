"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, ErrorState, EmptyState, Skeleton } from "@/components/ui";
import { formatMoney, formatNumber } from "@/lib/format";
import { t } from "@/lib/strings";
import { BooksResponse } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: BooksResponse };

/** Deterministic pastel for the cover placeholder, derived from the book id. */
const COVER_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

export default function BooksPage() {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (s: string, g: string, p: number) => {
    setState({ status: "loading" });
    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      if (g) params.set("genre", g);
      params.set("page", String(p));
      const res = await fetch(`/api/books?${params}`);
      if (!res.ok) {
        setState({ status: "error" });
        return;
      }
      setState({ status: "ready", data: await res.json() });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(search, genre, page), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, genre, page, load]);

  const data = state.status === "ready" ? state.data : null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t.books.title}
        </h1>
        <p className="text-slate-500 mt-1">{t.books.subtitle}</p>
      </div>

      {/* Search + genre filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t.books.searchPlaceholder}
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <select
          value={genre}
          onChange={(e) => {
            setGenre(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">{t.books.allGenres}</option>
          {(data?.genres ?? []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {state.status === "error" && (
        <ErrorState
          message={t.db.hanaUnreachable}
          onRetry={() => void load(search, genre, page)}
        />
      )}

      {state.status === "loading" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-4 w-3/4 mt-3" />
              <Skeleton className="h-3 w-1/2 mt-2" />
            </Card>
          ))}
        </div>
      )}

      {data && (
        <>
          <p className="text-sm text-slate-500">
            {t.books.resultsCount(data.total)}
          </p>

          {data.books.length === 0 ? (
            <EmptyState message={t.books.noResults} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.books.map((b) => (
                <Card key={b.bookId} className="p-4 flex flex-col">
                  <div
                    className={`h-36 rounded-lg flex items-center justify-center text-4xl font-bold ${COVER_COLORS[b.bookId % COVER_COLORS.length]}`}
                  >
                    {b.title.charAt(0).toUpperCase()}
                  </div>
                  <h3
                    className="font-semibold text-slate-900 text-sm mt-3 line-clamp-2"
                    title={b.title}
                  >
                    {b.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{b.author}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {b.genre}
                    </span>
                    {b.avgRating !== null && (
                      <span className="text-amber-600 font-medium">
                        ★ {b.avgRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-end justify-between mt-auto pt-3">
                    <span className="font-bold text-slate-900 tabular-nums">
                      {formatMoney(b.price)}
                    </span>
                    <span
                      className={`text-xs ${b.stock > 0 ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {b.stock > 0
                        ? `${formatNumber(b.stock)} ${t.books.inStock}`
                        : t.books.outOfStock}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              ← {t.common.previous}
            </button>
            <span className="text-sm text-slate-600 tabular-nums">
              {t.common.page} {page} {t.common.of} {formatNumber(totalPages)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              {t.common.next} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
