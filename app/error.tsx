"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getHint(message: string): string | null {
  if (message.includes("DATABASE_URL") || message.includes("not set")) {
    return "Database is not configured. On Railway: add a Postgres service, link it to this app, and ensure DATABASE_URL is set in Variables (it is usually set automatically when you link the database).";
  }
  if (message.includes("connect") || message.includes("ECONNREFUSED") || message.includes("timeout")) {
    return "Cannot reach the database. Check that the Postgres service is running and DATABASE_URL is correct. If you just added the database, wait a minute and try again.";
  }
  if (message.includes("password") || message.includes("authentication")) {
    return "Database authentication failed. Check that DATABASE_URL (username and password) is correct in Railway Variables.";
  }
  return null;
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const hint = getHint(error?.message ?? "");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          An error occurred while loading this page. You can try again or return
          to the dashboard.
        </p>
        {hint && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900">
            {hint}
          </p>
        )}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            {showDetails ? "Hide" : "Show"} error details
          </button>
          {showDetails && error?.message && (
            <pre className="mt-2 max-h-32 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-left text-xs text-slate-700">
              {error.message}
            </pre>
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="btn-primary px-5 py-2.5"
          >
            Try again
          </button>
          <Link href="/login" className="btn-secondary inline-flex px-5 py-2.5">
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}
