"use client";

import { useCallback, useEffect, useRef } from "react";

const IDLE_MS = 30 * 60 * 1000; // 30 minutes

export function SessionTimeout() {
  const lastActivity = useRef(Date.now());
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  const redirectToLogin = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      window.location.href = "/login?message=session_expired";
    });
  }, []);

  const resetTimer = useCallback(() => {
    lastActivity.current = Date.now();
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
    timeoutId.current = setTimeout(redirectToLogin, IDLE_MS);
  }, [redirectToLogin]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, [resetTimer]);

  return null;
}
