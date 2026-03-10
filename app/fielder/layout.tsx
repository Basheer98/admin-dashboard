import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function FielderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "fielder") {
    redirect("/login");
  }

  const displayName = session.fielderName;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-900/50 sm:flex-row">
      <aside className="flex w-full flex-col border-b border-zinc-700 bg-slate-900 px-4 py-6 sm:w-56 sm:border-b-0 sm:border-r sm:border-zinc-700">
        <h1 className="font-display text-lg font-bold text-white">
          {displayName}
        </h1>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
          My dashboard
        </p>
        <nav className="mt-6 flex flex-col gap-1">
          <Link
            href="/fielder"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            My statement
          </Link>
          <Link
            href="/fielder/assignments"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            My assignments
          </Link>
          <Link
            href="/fielder/payments"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            My payments
          </Link>
        </nav>
        <form method="POST" action="/api/auth/logout" className="mt-auto pt-6">
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-600 px-3 py-2.5 text-left text-sm font-medium text-zinc-500 hover:bg-white/5 hover:text-white"
          >
            Log out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
