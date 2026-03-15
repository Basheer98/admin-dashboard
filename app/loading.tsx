export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-8 px-4 py-8">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-4 w-80 animate-pulse rounded bg-zinc-800/60" />
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-zinc-800/70 border border-zinc-800"
          />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl bg-zinc-800/60 border border-zinc-800"
          />
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-5 w-40 animate-pulse rounded bg-zinc-800/60" />
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="h-12 animate-pulse bg-zinc-800/80" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 animate-pulse bg-zinc-900/60 border-t border-zinc-800" />
          ))}
        </div>
      </div>
      <div className="flex justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-400" aria-hidden />
      </div>
    </div>
  );
}
