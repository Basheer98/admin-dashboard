"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TOAST_MESSAGES: Record<string, string> = {
  saved: "Saved.",
  project_saved: "Project saved.",
  payment_logged: "Payment logged.",
  project_deleted: "Project deleted.",
  assignment_deleted: "Assignment deleted.",
  payment_voided: "Payment voided.",
  archived: "Archived.",
  unarchived: "Unarchived.",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Please fix the errors below.",
};

export function Toast() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const toastParam = params.get("toast");
    const successParam = params.get("success");
    const savedParam = params.get("saved");
    const errorParam = params.get("error");

    if (errorParam) {
      const msg = ERROR_MESSAGES[errorParam] ?? "Something went wrong.";
      params.delete("error");
      const newUrl = pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", newUrl);
      const id = setTimeout(() => {
        setMessage(msg);
        setIsError(true);
        setVisible(true);
      }, 0);
      const hideId = setTimeout(() => {
        setVisible(false);
        setIsError(false);
      }, 4000);
      return () => {
        clearTimeout(id);
        clearTimeout(hideId);
      };
    }

    const t =
      toastParam ||
      (successParam === "1" ? "saved" : null) ||
      (savedParam === "1" ? "saved" : null);
    if (t) {
      const msg = TOAST_MESSAGES[t] ?? "Saved.";
      params.delete("toast");
      params.delete("success");
      params.delete("saved");
      const newUrl = pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", newUrl);
      const id = setTimeout(() => {
        setMessage(msg);
        setIsError(false);
        setVisible(true);
      }, 0);
      const hideId = setTimeout(() => setVisible(false), 3000);
      return () => {
        clearTimeout(id);
        clearTimeout(hideId);
      };
    }
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        isError
          ? "fixed bottom-8 right-8 z-50 rounded-2xl border border-red-200/80 bg-red-50/95 backdrop-blur-md px-6 py-4 text-sm font-semibold text-red-800 shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
          : "fixed bottom-8 right-8 z-50 rounded-2xl border border-zinc-600 bg-zinc-900/95 backdrop-blur-md px-6 py-4 text-sm font-semibold text-zinc-100 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      }
    >
      {message}
    </div>
  );
}
