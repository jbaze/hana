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
import { formatMoney, formatNumber } from "@/lib/format";

const GREEN = "#047857";
const AMBER = "#b45309";
const AXIS = { fontSize: 12, fill: "#64748b" };

export function MonthlyBarChart({
  data,
  dataKey,
  name,
  height = 260,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  name: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tick={AXIS} minTickGap={20} />
        <YAxis tick={AXIS} width={44} />
        <Tooltip formatter={(v) => [formatNumber(Number(v)), name]} />
        <Bar dataKey={dataKey} name={name} fill={GREEN} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProductionChart({
  data,
  goodLabel,
  defectLabel,
  height = 280,
}: {
  data: { month: string; good: number; defect: number }[];
  goodLabel: string;
  defectLabel: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tick={AXIS} minTickGap={20} />
        <YAxis tick={AXIS} width={44} />
        <Tooltip formatter={(v) => [formatNumber(Number(v))]} />
        <Legend />
        <Bar dataKey="good" stackId="a" name={goodLabel} fill={GREEN} />
        <Bar dataKey="defect" stackId="a" name={defectLabel} fill={AMBER} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueLineChart({
  data,
  name,
  height = 280,
}: {
  data: { month: string; revenue: number }[];
  name: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tick={AXIS} minTickGap={20} />
        <YAxis
          tick={AXIS}
          width={52}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}К`}
        />
        <Tooltip formatter={(v) => [formatMoney(Number(v)), name]} />
        <Line type="monotone" dataKey="revenue" name={name} stroke={GREEN} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({
  data,
  nameKey,
  valueKey,
  label,
  height = 280,
}: {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  label: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tick={AXIS} />
        <YAxis type="category" dataKey={nameKey} tick={{ ...AXIS, fontSize: 11 }} width={130} />
        <Tooltip formatter={(v) => [formatNumber(Number(v)), label]} />
        <Bar dataKey={valueKey} name={label} fill={GREEN} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
