"use client";

import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");
  const emailPrefill = searchParams.get("email") ?? "";
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  const isSessionExpired = message === "session_expired";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="card w-full max-w-md p-8">
        <h1 className="mb-6 text-center text-3xl font-semibold text-slate-900">
          Sign in
        </h1>

        {isSessionExpired && (
          <p className="mb-4 text-base text-amber-700 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            Session expired. You were signed out due to inactivity. Please sign in again.
          </p>
        )}
        {error && !isSessionExpired && (
          <p className="mb-4 text-base text-red-600">
            Invalid email or password. Please try again.
          </p>
        )}

        <form method="POST" action="/api/auth/login" className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <div className="space-y-1">
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={emailPrefill}
              className="input px-4 py-3"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input px-4 py-3"
            />
          </div>

          <button type="submit" className="btn-primary mt-4 w-full px-5 py-3">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

