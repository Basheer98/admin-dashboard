export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200/80" />
      <div className="flex flex-wrap gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 w-full min-w-[200px] max-w-[280px] animate-pulse rounded-2xl bg-slate-200/60"
          />
        ))}
      </div>
      <div className="h-64 w-full animate-pulse rounded-2xl bg-slate-200/60" />
      <div className="h-64 w-full animate-pulse rounded-2xl bg-slate-200/60" />
    </div>
  );
}
