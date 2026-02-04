import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50 to-indigo-50/30 px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Page not found
        </h1>
        <p className="mt-2 text-slate-600">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <nav className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            href="/"
            className="btn-primary inline-flex items-center justify-center px-5 py-2.5"
          >
            Dashboard
          </Link>
          <Link
            href="/projects"
            className="btn-secondary inline-flex items-center justify-center px-5 py-2.5"
          >
            Projects
          </Link>
          <Link
            href="/fielders"
            className="btn-secondary inline-flex items-center justify-center px-5 py-2.5"
          >
            Fielder reports
          </Link>
          <Link
            href="/settings"
            className="btn-secondary inline-flex items-center justify-center px-5 py-2.5"
          >
            Settings
          </Link>
        </nav>
      </div>
    </div>
  );
}
