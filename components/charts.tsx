"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { t } from "@/lib/strings";
import { formatMoney, formatMs, formatNumber } from "@/lib/format";

const HANA_COLOR = "#4f46e5";
const PG_COLOR = "#0d9488";
const AXIS_STYLE = { fontSize: 12, fill: "#64748b" };

export function TopGenresChart({
  data,
}: {
  data: { genre: string; sold: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="genre"
          tick={AXIS_STYLE}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={70}
        />
        <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => formatNumber(v)} />
        <Tooltip
          formatter={(value) => [
            `${formatNumber(Number(value))} ${t.dashboard.soldCopies}`,
          ]}
        />
        <Bar dataKey="sold" fill={HANA_COLOR} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueTrendChart({
  data,
}: {
  data: { month: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tick={AXIS_STYLE} minTickGap={30} />
        <YAxis
          tick={AXIS_STYLE}
          tickFormatter={(v: number) => `${Math.round(v / 1_000_000)}М`}
          width={50}
        />
        <Tooltip formatter={(value) => [formatMoney(Number(value))]} />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke={HANA_COLOR}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export interface ComparePoint {
  name: string;
  hana: number | null;
  postgres: number | null;
}

/** Grouped bars: HANA vs PostgreSQL median time per query. */
export function CompareChart({
  data,
  height = 300,
}: {
  data: ComparePoint[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={AXIS_STYLE}
          interval={0}
          angle={data.length > 3 ? -20 : 0}
          textAnchor={data.length > 3 ? "end" : "middle"}
          height={data.length > 3 ? 80 : 30}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickFormatter={(v: number) => formatMs(v)}
          width={70}
        />
        <Tooltip formatter={(value) => [formatMs(Number(value))]} />
        <Legend />
        <Bar dataKey="hana" name={t.db.hana} fill={HANA_COLOR} radius={[4, 4, 0, 0]} />
        <Bar
          dataKey="postgres"
          name={t.db.postgres}
          fill={PG_COLOR}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
