import { getAllActivity } from "@/lib/db";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { PrintButton } from "@/app/components/PrintButton";

export default async function ActivityPage() {
  const activities = await getAllActivity(200);

  return (
    <SidebarLayout title="Activity log" current="activity" headerAction={<PrintButton />}>
      <div className="flex flex-1 flex-col gap-8 print-content">
        <p className="text-sm text-slate-600 no-print">
          Simple audit trail: project creation and payment logging.
        </p>
        <section className="card overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Activity</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} className="border-t border-slate-200 text-slate-800">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{a.description}</td>
                  <td className="max-w-xs px-3 py-2 text-slate-500">
                    {a.metadata?.changes && typeof a.metadata.changes === "object" ? (
                      <span className="text-xs">
                        {Object.entries(a.metadata.changes as Record<string, { old: unknown; new: unknown }>)
                          .map(([k, v]) => `${k}: ${String(v.old)} → ${String(v.new)}`)
                          .join("; ")}
                      </span>
                    ) : a.metadata?.usdToInrRate && typeof a.metadata.usdToInrRate === "object" ? (
                      <span className="text-xs">
                        {String((a.metadata.usdToInrRate as { old: unknown }).old)} → {String((a.metadata.usdToInrRate as { new: unknown }).new)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {activities.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    No activity yet.
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
