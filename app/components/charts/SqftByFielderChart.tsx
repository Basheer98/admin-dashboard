"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export type SqftAssignmentPoint = {
  fielderName: string;
  createdAt: string;
  totalSqft: number;
};

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#7c3aed",
  "#a855f7",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#65a30d",
  "#059669",
  "#0d9488",
  "#0891b2",
];

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

function getWeekStart(d: Date): Date {
  if (!isValidDate(d)) return d;
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${weekStart.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

type SqftByFielderChartProps = {
  assignments: SqftAssignmentPoint[];
};

export function SqftByFielderChart({ assignments }: SqftByFielderChartProps) {
  const router = useRouter();
  const [periodType, setPeriodType] = useState<"week" | "month">("month");

  const { chartData, fielders } = useMemo(() => {
    if (assignments.length === 0) {
      return { chartData: [], fielders: [] as string[] };
    }

    const now = new Date();
    const fielderSqftByPeriod = new Map<string, Map<string, number>>();
    const allFieldersFromData = new Set<string>();

    const getAssignmentDate = (a: SqftAssignmentPoint): Date => {
      if (a.createdAt != null && a.createdAt !== "") {
        const d = new Date(a.createdAt);
        if (isValidDate(d)) return d;
      }
      return now;
    };

    const add = (periodKey: string, fielder: string, sqft: number) => {
      if (!fielderSqftByPeriod.has(periodKey)) {
        fielderSqftByPeriod.set(periodKey, new Map());
      }
      const byFielder = fielderSqftByPeriod.get(periodKey)!;
      byFielder.set(fielder, (byFielder.get(fielder) ?? 0) + sqft);
    };

    if (periodType === "week") {
      const validDates = assignments.map(getAssignmentDate);
      const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime()), now.getTime()));
      const weekStarts: Date[] = [];
      const startWeek = getWeekStart(minDate);
      const endWeek = getWeekStart(maxDate);
      let current = new Date(startWeek);
      const maxWeeks = 52;
      while (current <= endWeek && weekStarts.length < maxWeeks) {
        weekStarts.push(new Date(current));
        current.setDate(current.getDate() + 7);
      }
      if (weekStarts.length === 0) weekStarts.push(new Date(startWeek));

      const periodKeys = weekStarts.map((ws) => ws.toISOString().slice(0, 10));
      periodKeys.forEach((pk) => fielderSqftByPeriod.set(pk, new Map()));

      assignments.forEach((a) => {
        const d = getAssignmentDate(a);
        allFieldersFromData.add(a.fielderName);
        const ws = getWeekStart(d);
        if (!isValidDate(ws)) return;
        const key = ws.toISOString().slice(0, 10);
        if (fielderSqftByPeriod.has(key)) {
          add(key, a.fielderName, a.totalSqft);
        } else {
          const nearest = periodKeys[0];
          if (key <= periodKeys[0]) add(periodKeys[0], a.fielderName, a.totalSqft);
          else if (key >= periodKeys[periodKeys.length - 1]) add(periodKeys[periodKeys.length - 1], a.fielderName, a.totalSqft);
        }
      });

      const fieldersSorted = Array.from(allFieldersFromData).sort();

      const chartData = periodKeys.map((key) => {
        const byFielder = fielderSqftByPeriod.get(key) ?? new Map();
        const row: Record<string, string | number> = {
          name: formatWeekLabel(new Date(key)),
          _key: key,
        };
        fieldersSorted.forEach((f) => {
          row[f] = byFielder.get(f) ?? 0;
        });
        return row;
      });

      return { chartData, fielders: fieldersSorted };
    } else {
      const validDates = assignments.map(getAssignmentDate);
      const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime()), now.getTime()));
      const monthKeys: string[] = [];
      const maxMonths = 24;
      const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      let current = new Date(start);
      while (current <= end && monthKeys.length < maxMonths) {
        monthKeys.push(getMonthKey(current));
        current.setMonth(current.getMonth() + 1);
      }
      if (monthKeys.length === 0) monthKeys.push(getMonthKey(now));

      monthKeys.forEach((pk) => fielderSqftByPeriod.set(pk, new Map()));

      assignments.forEach((a) => {
        const d = getAssignmentDate(a);
        allFieldersFromData.add(a.fielderName);
        const key = getMonthKey(d);
        if (fielderSqftByPeriod.has(key)) {
          add(key, a.fielderName, a.totalSqft);
        } else {
          if (key <= monthKeys[0]) add(monthKeys[0], a.fielderName, a.totalSqft);
          else if (key >= monthKeys[monthKeys.length - 1]) add(monthKeys[monthKeys.length - 1], a.fielderName, a.totalSqft);
        }
      });

      const fieldersSorted = Array.from(allFieldersFromData).sort();

      const chartData = monthKeys.map((key) => {
        const byFielder = fielderSqftByPeriod.get(key) ?? new Map();
        const row: Record<string, string | number> = {
          name: formatMonthLabel(key),
          _key: key,
        };
        fieldersSorted.forEach((f) => {
          row[f] = byFielder.get(f) ?? 0;
        });
        return row;
      });

      return { chartData, fielders: fieldersSorted };
    }
  }, [assignments, periodType]);

  const formatTick = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return String(value);
  };

  if (assignments.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-slate-500">
        No assignment data yet. SQFT is shown by when the fielder was assigned to each project.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Group by:</span>
          <button
            type="button"
            onClick={() => setPeriodType("week")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              periodType === "week"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            By week
          </button>
          <button
            type="button"
            onClick={() => setPeriodType("month")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              periodType === "month"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            By month
          </button>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          aria-label="Refresh chart data"
        >
          Refresh data
        </button>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="horizontal"
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
            <XAxis
              dataKey="name"
              className="text-xs"
              tick={{ fill: "#64748b" }}
              tickFormatter={(v) => (typeof v === "string" && v.length > 12 ? v.slice(0, 10) + "…" : v)}
            />
            <YAxis
              tickFormatter={formatTick}
              className="text-xs"
              tick={{ fill: "#64748b" }}
              domain={[0, "auto"]}
              allowDataOverflow={false}
            />
            <Tooltip
              formatter={(value: number) =>
                value.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }) + " sqft"
              }
              contentStyle={{
                backgroundColor: "rgb(255 255 255)",
                border: "1px solid rgb(226 232 240)",
                borderRadius: "0.5rem",
              }}
              labelStyle={{ color: "#334155" }}
            />
            <Legend />
            {fielders.map((fielder, i) => (
              <Bar
                key={fielder}
                dataKey={fielder}
                stackId="sqft"
                fill={COLORS[i % COLORS.length]}
                name={fielder}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
