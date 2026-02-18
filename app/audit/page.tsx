import Link from "next/link";
import { getAuditEntries } from "@/lib/db";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { PrintButton } from "@/app/components/PrintButton";
import { AuditFilters } from "./AuditFilters";

const ACTIONS = [
  "project.create",
  "project.update",
  "project.archive",
  "project.unarchive",
  "project.delete",
  "project.bulk_invoice",
  "assignment.create",
  "assignment.update",
  "assignment.archive",
  "assignment.unarchive",
  "assignment.delete",
  "payment.create",
  "payment.void",
  "setting.update",
  "fielder_login.create",
  "fielder_login.reset_password",
  "additional_work.create",
  "additional_work.update",
  "assignment_template.create",
  "assignment_template.delete",
  "assignment_template.apply",
  "settings.normalize_fielder_names",
  "backup.restore",
];

const ENTITY_TYPES = ["project", "assignment", "payment", "setting", "fielder_login", "additional_work", "assignment_template"];

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const actorName = typeof params.actor === "string" ? params.actor.trim() || undefined : undefined;
  const action = typeof params.action === "string" ? params.action : undefined;
  const entityType = typeof params.entityType === "string" ? params.entityType : undefined;
  const fromDate = typeof params.from === "string" ? params.from : undefined;
  const toDate = typeof params.to === "string" ? params.to : undefined;

  const entries = await getAuditEntries({
    actorName,
    action,
    entityType,
    fromDate,
    toDate,
    limit: 500,
  });

  const exportParams = new URLSearchParams();
  if (actorName) exportParams.set("actor", actorName);
  if (action) exportParams.set("action", action);
  if (entityType) exportParams.set("entityType", entityType);
  if (fromDate) exportParams.set("from", fromDate);
  if (toDate) exportParams.set("to", toDate);
  const exportHref = `/api/export/audit?${exportParams.toString()}`;

  return (
    <SidebarLayout
      title="Audit trail"
      current="audit"
      headerAction={
        <div className="flex items-center gap-2 no-print">
          <Link
            href={exportHref}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
            download
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </Link>
          <PrintButton />
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-6 print-content">
        <p className="text-sm text-slate-600 no-print">
          Who did what, when. Filter by actor, action, entity type, or date range.
        </p>
        <AuditFilters
          actorName={actorName}
          action={action}
          entityType={entityType}
          fromDate={fromDate}
          toDate={toDate}
          actions={ACTIONS}
          entityTypes={ENTITY_TYPES}
        />
        <section className="card overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-slate-200 text-slate-800">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{e.actorName}</span>
                    <span className="ml-1 text-slate-500 text-xs">({e.actorType})</span>
                  </td>
                  <td className="px-3 py-2">{e.action}</td>
                  <td className="px-3 py-2">{e.entityType}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.entityId ?? "—"}</td>
                  <td className="max-w-xs px-3 py-2 text-slate-500">
                    {e.details && Object.keys(e.details).length > 0 ? (
                      <span className="text-xs">
                        {Object.entries(e.details)
                          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                          .join("; ")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                    No audit entries match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </SidebarLayout>
  );
}
