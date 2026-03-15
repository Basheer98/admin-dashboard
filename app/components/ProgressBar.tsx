type ProgressBarProps = {
  value: number;
  max: number;
  showLabel?: boolean;
  className?: string;
  height?: "sm" | "md";
};

export function ProgressBar({
  value,
  max,
  showLabel = true,
  className = "",
  height = "sm",
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const h = height === "sm" ? "h-1.5" : "h-2";
  return (
    <div className={`w-full ${className}`}>
      <div
        className={`overflow-hidden rounded-full bg-zinc-800 ${h}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full bg-zinc-500 transition-all duration-300 ${h}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && max > 0 && (
        <p className="mt-1 text-xs text-zinc-500">
          {pct.toFixed(0)}% paid
        </p>
      )}
    </div>
  );
}
