"use client";

import { useRouter } from "next/navigation";

type AuditFiltersProps = {
  actorName?: string;
  action?: string;
  entityType?: string;
  fromDate?: string;
  toDate?: string;
  actions: string[];
  entityTypes: string[];
};

export function AuditFilters({
  actorName,
  action,
  entityType,
  fromDate,
  toDate,
  actions,
  entityTypes,
}: AuditFiltersProps) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams();
    const a = (data.get("actor") as string)?.trim();
    const act = (data.get("action") as string)?.trim();
    const et = (data.get("entityType") as string)?.trim();
    const from = (data.get("from") as string)?.trim();
    const to = (data.get("to") as string)?.trim();
    if (a) params.set("actor", a);
    if (act) params.set("action", act);
    if (et) params.set("entityType", et);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/audit?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card no-print flex flex-wrap items-end gap-4 p-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Who (actor)</span>
        <input
          type="text"
          name="actor"
          defaultValue={actorName}
          placeholder="Name or email"
          className="input w-40"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Action</span>
        <select name="action" className="input w-52" defaultValue={action ?? ""}>
          <option value="">All</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Entity type</span>
        <select name="entityType" className="input w-40" defaultValue={entityType ?? ""}>
          <option value="">All</option>
          {entityTypes.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">From date</span>
        <input type="date" name="from" defaultValue={fromDate} className="input w-40" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">To date</span>
        <input type="date" name="to" defaultValue={toDate} className="input w-40" />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary px-4 py-2">
          Apply
        </button>
        <button
          type="button"
          onClick={() => router.push("/audit")}
          className="btn-secondary px-4 py-2"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
