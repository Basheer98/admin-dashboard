"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientRow } from "@/lib/db";

export function ClientRowActions({ client }: { client: ClientRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email ?? "");
  const [address, setAddress] = useState(client.address ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: address.trim() || null, email: email.trim() || null }),
      });
      if (!res.ok) {
        alert("Could not save client");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete client "${client.name}"? Existing invoices keep their saved bill-to text.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Could not delete client");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex min-w-[280px] flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input h-9 text-sm" />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="input h-9 text-sm"
        />
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          className="input py-2 text-sm"
          placeholder="Address"
        />
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => setEditing(true)} className="text-sm text-emerald-400 hover:underline">
        Edit
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="text-sm text-red-400 hover:underline"
      >
        Delete
      </button>
    </div>
  );
}
