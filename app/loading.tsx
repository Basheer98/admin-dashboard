export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-6 px-4 py-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-zinc-800/60"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-zinc-800/60" />
      <div className="h-64 animate-pulse rounded-2xl bg-zinc-800/60" />
    </div>
  );
}
