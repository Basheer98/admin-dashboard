"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => setCsrfToken(""));
  }, []);

  if (csrfToken === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-600">Loading…</div>
      </div>
    );
  }

  return <LoginForm csrfToken={csrfToken} />;
}
