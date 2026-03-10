"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export type MonthlyDataPoint = {
  monthKey: string;
  label: string;
  revenue: number;
  payouts: number;
};

type RevenueVsPayoutsChartProps = {
  data: MonthlyDataPoint[];
};

export function RevenueVsPayoutsChart({ data }: RevenueVsPayoutsChartProps) {
  const chartData = data.map((d) => ({
    name: d.label,
    revenue: d.revenue,
    payouts: d.payouts,
  }));

  const formatTick = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return String(value);
  };

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#52525b" />
          <XAxis dataKey="name" className="text-xs" tick={{ fill: "#71717a" }} />
          <YAxis tickFormatter={formatTick} className="text-xs" tick={{ fill: "#71717a" }} />
          <Tooltip
            formatter={(value: number) =>
              value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            }
            contentStyle={{ backgroundColor: "#262626", border: "1px solid #52525b" }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ fill: "#22c55e" }}
          />
          <Line
            type="monotone"
            dataKey="payouts"
            name="Payouts"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: "#f59e0b" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
