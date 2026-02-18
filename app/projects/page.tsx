import { getAllAssignments, getAllProjects, getAssignmentsWithDetails } from "@/lib/db";
import { getProjectEcdStatus } from "@/lib/dueDate";
import { getProjectStatusLabel, PROJECT_STATUS_VALUES } from "@/lib/projectStatus";
import { formatCurrency, formatRate } from "@/lib/currency";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { FilterChips } from "@/app/components/FilterChips";
import { SortLink } from "@/app/components/SortLink";
import Link from "next/link";
import { AddProjectForm } from "./components/AddProjectForm";
import { PrintButton } from "@/app/components/PrintButton";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const showArchived = sp.archived === "1";
  const unarchived = sp.unarchived === "1";
  const success = sp.success === "1";
  const successBulkInvoice = sp.success === "bulk_invoice";
  const bulkInvoiceCount = typeof sp.count === "string" ? sp.count : "";
  const errorInvalid = sp.error === "invalid";
  const errorServer = sp.error === "server";
  const errorBulkInvoice = sp.error === "bulk_invoice_no_selection";
  const filterClient = typeof sp.client === "string" ? sp.client.trim() : "";
  const filterStatus = typeof sp.status === "string" ? sp.status : "";
  const filterInvoice = typeof sp.invoice === "string" ? sp.invoice.trim() : "";
  const filterFrom = typeof sp.from === "string" && sp.from ? sp.from : "";
  const filterTo = typeof sp.to === "string" && sp.to ? sp.to : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "createdAt";
  const order = sp.order === "asc" ? "asc" : "desc";
  const pageSize = Math.min(100, Math.max(10, Number(sp.pageSize) || 20));
  const page = Math.max(1, Number(sp.page) || 1);

  const allProjects = await getAllProjects({ includeArchived: true });
  let projects = showArchived
    ? allProjects.filter((p) => p.archivedAt)
    : allProjects.filter((p) => !p.archivedAt);
  if (filterClient) {
    projects = projects.filter((p) =>
      p.clientName.toLowerCase().includes(filterClient.toLowerCase()),
    );
  }
  if (filterStatus) {
    projects = projects.filter((p) => p.status === filterStatus);
  }
  if (filterFrom) {
    projects = projects.filter((p) => p.createdAt.slice(0, 10) >= filterFrom);
  }
  if (filterTo) {
    projects = projects.filter((p) => p.createdAt.slice(0, 10) <= filterTo);
  }
  if (filterInvoice) {
    projects = projects.filter((p) => (p.invoiceNumber ?? "").trim() === filterInvoice);
  }

  const totalCount = projects.length;
  const uniqueInvoiceNumbers = Array.from(
    new Set(allProjects.map((p) => (p.invoiceNumber ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sortKey = ["projectCode", "clientName", "qfield", "location", "totalSqft", "companyRatePerSqft", "revenue", "profit", "marginPct", "status", "ecd", "createdAt"].includes(sort) ? sort : "createdAt";
  projects = [...projects].sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    if (sortKey === "revenue") {
      va = a.totalSqft * Number(a.companyRatePerSqft);
      vb = b.totalSqft * Number(b.companyRatePerSqft);
    } else if (sortKey === "profit") {
      const revA = a.totalSqft * Number(a.companyRatePerSqft);
      const revB = b.totalSqft * Number(b.companyRatePerSqft);
      va = revA - (projectRequiredPayouts.get(a.id) ?? 0);
      vb = revB - (projectRequiredPayouts.get(b.id) ?? 0);
    } else if (sortKey === "marginPct") {
      const revA = a.totalSqft * Number(a.companyRatePerSqft);
      const revB = b.totalSqft * Number(b.companyRatePerSqft);
      va = revA > 0 ? ((revA - (projectRequiredPayouts.get(a.id) ?? 0)) / revA) * 100 : 0;
      vb = revB > 0 ? ((revB - (projectRequiredPayouts.get(b.id) ?? 0)) / revB) * 100 : 0;
    } else if (sortKey === "companyRatePerSqft") {
      va = Number(a.companyRatePerSqft);
      vb = Number(b.companyRatePerSqft);
    } else if (sortKey === "projectCode") {
      va = a.projectCode;
      vb = b.projectCode;
    } else if (sortKey === "clientName") {
      va = a.clientName;
      vb = b.clientName;
    } else if (sortKey === "qfield") {
      va = a.qfield ?? "";
      vb = b.qfield ?? "";
    } else if (sortKey === "location") {
      va = a.location ?? "";
      vb = b.location ?? "";
    } else if (sortKey === "totalSqft") {
      va = a.totalSqft;
      vb = b.totalSqft;
    } else if (sortKey === "status") {
      va = a.status;
      vb = b.status;
    } else if (sortKey === "ecd") {
      va = a.ecd ?? "";
      vb = b.ecd ?? "";
    } else {
      va = a.createdAt;
      vb = b.createdAt;
    }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return order === "asc" ? cmp : -cmp;
  });
  const paginatedProjects = projects.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(totalCount / pageSize);

  const [assignments, assignmentsWithDetails] = await Promise.all([
    getAllAssignments({ includeArchived: showArchived }),
    getAssignmentsWithDetails({ includeArchived: showArchived }),
  ]);
  const projectRequiredPayouts = new Map<number, number>();
  for (const p of projects) {
    const projectAssignments = assignments.filter((a) => a.projectId === p.id);
    let required = 0;
    projectAssignments.forEach((a) => {
      if (a.isInternal) return;
      const sqft = p.totalSqft;
      const workerRate = Number(a.ratePerSqft);
      if (a.managedByFielderId && a.managerRatePerSqft) {
        const managerRate = Number(a.managerRatePerSqft);
        const managerCommission = (managerRate - workerRate) * sqft;
        const managerShare = a.managerCommissionShare ? Number(a.managerCommissionShare) : 0;
        required += workerRate * sqft + (managerCommission - managerCommission * managerShare);
      } else {
        required += workerRate * sqft;
        if (a.commissionPercentage) required += workerRate * sqft * Number(a.commissionPercentage);
      }
    });
    projectRequiredPayouts.set(p.id, required);
  }
  const uniqueFielderNames = Array.from(
    new Set(assignments.map((a) => a.fielderName).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const uniqueClientNames = Array.from(
    new Set(allProjects.map((p) => p.clientName).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const hasFilters = !!(filterClient || filterStatus || filterInvoice || filterFrom || filterTo);
  const projectFilterChips = hasFilters
    ? [
        filterClient && { key: "client", label: "Client", value: filterClient },
        filterStatus && { key: "status", label: "Status", value: getProjectStatusLabel(filterStatus) },
        filterInvoice && { key: "invoice", label: "Invoice", value: filterInvoice },
        filterFrom && { key: "from", label: "From", value: filterFrom },
        filterTo && { key: "to", label: "To", value: filterTo },
      ].filter(Boolean) as { key: string; label: string; value: string }[]
    : [];
  const projectPreserveParams: Record<string, string> = {
    ...(filterClient && { client: filterClient }),
    ...(filterStatus && { status: filterStatus }),
    ...(filterInvoice && { invoice: filterInvoice }),
    ...(filterFrom && { from: filterFrom }),
    ...(filterTo && { to: filterTo }),
    ...(showArchived && { archived: "1" }),
  };
  const sortPreserveParams = { ...projectPreserveParams, pageSize: String(pageSize) };

  return (
    <SidebarLayout title="Projects" current="projects" headerAction={<PrintButton />}>
      <div className="flex flex-1 flex-col gap-8">
        {success && (
          <div className="rounded-2xl border border-indigo-200/80 bg-white px-5 py-4 text-sm font-semibold text-indigo-900 shadow-lg">
            Project saved.{" "}
            <Link href="/assignments" className="font-medium underline hover:no-underline">
              Assign fielders
            </Link>
            {" or "}
            <Link href="/payments" className="font-medium underline hover:no-underline">
              Log payment
            </Link>
            .
          </div>
        )}
        {errorInvalid && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Please check the form: all required fields must be valid (e.g. project ID, client, total SQFT, rate).
          </div>
        )}
        {errorServer && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Something went wrong while saving the project. Please try again. If it keeps failing, check the deployment logs.
          </div>
        )}
        {successBulkInvoice && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Invoice updated for {bulkInvoiceCount} project{bulkInvoiceCount !== "1" ? "s" : ""}.
          </div>
        )}
        {errorBulkInvoice && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Select at least one project to set invoice.
          </div>
        )}
        {unarchived && (
          <div className="rounded-2xl border border-indigo-200/80 bg-white px-5 py-4 text-sm font-semibold text-indigo-900 shadow-lg">
            Project unarchived.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {showArchived ? (
            <Link
              href="/projects"
              className="text-sm font-medium text-slate-700 underline hover:text-slate-900"
            >
              ← Back to active projects
            </Link>
          ) : (
            <Link
              href="/projects?archived=1"
              className="text-sm font-medium text-slate-700 underline hover:text-slate-900"
            >
              View archived projects
            </Link>
          )}
        </div>
        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Filter projects
          </h2>
          <form method="get" action="/projects" className="flex flex-wrap items-end gap-3">
            {showArchived && <input type="hidden" name="archived" value="1" />}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Client</label>
              <input
                type="text"
                name="client"
                defaultValue={filterClient}
                placeholder="Filter by client name"
                className="h-11 rounded-md border border-slate-300 px-3 py-2 text-base text-black bg-white w-48"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select
                name="status"
                defaultValue={filterStatus}
                className="h-11 rounded-md border border-slate-300 px-3 py-2 text-base text-black bg-white"
              >
                <option value="">All statuses</option>
                {PROJECT_STATUS_VALUES.map((v) => (
                  <option key={v} value={v}>{getProjectStatusLabel(v)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Invoice</label>
              <select
                name="invoice"
                defaultValue={filterInvoice}
                className="h-11 rounded-md border border-slate-300 px-3 py-2 text-base text-black bg-white"
              >
                <option value="">All invoices</option>
                {uniqueInvoiceNumbers.map((inv) => (
                  <option key={inv} value={inv}>{inv}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Created from</label>
              <input
                type="date"
                name="from"
                defaultValue={filterFrom}
                className="h-11 rounded-md border border-slate-300 px-3 py-2 text-base text-black bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Created to</label>
              <input
                type="date"
                name="to"
                defaultValue={filterTo}
                className="h-11 rounded-md border border-slate-300 px-3 py-2 text-base text-black bg-white"
              />
            </div>
            <button
              type="submit"
              className="btn-primary h-11 px-5 text-sm"
            >
              Apply
            </button>
            {(filterClient || filterStatus || filterInvoice || filterFrom || filterTo) && (
              <Link
                href={showArchived ? "/projects?archived=1" : "/projects"}
                className="h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center"
              >
                Clear filter
              </Link>
            )}
          </form>
        </section>
        {!showArchived && (
          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
              Add project
            </h2>
            <AddProjectForm
            assignments={assignmentsWithDetails}
            uniqueFielderNames={uniqueFielderNames}
            uniqueClientNames={uniqueClientNames}
          />
          </section>
        )}

        {hasFilters && (
          <FilterChips
            chips={projectFilterChips}
            basePath="/projects"
            preserveParams={projectPreserveParams}
            className="no-print"
          />
        )}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {showArchived ? "Archived projects" : "Project list"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/export/projects${showArchived ? "?archived=1" : ""}`}
                download
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Export CSV
              </a>
            </div>
          </div>
          <form id="bulk-invoice-form" method="POST" action="/api/projects/bulk-invoice" className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Set invoice for selected:</label>
            <input
              type="text"
              name="invoiceNumber"
              placeholder="e.g. 002"
              className="h-9 w-28 rounded-md border border-slate-300 px-2 text-sm"
            />
            <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Apply
            </button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm max-h-[70vh] overflow-y-auto">
            <table className="table-sticky table-hover table-zebra min-w-full text-left text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 w-10" title="Select for bulk set invoice">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="Project" sortKey="projectCode" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="Client" sortKey="clientName" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">
                    <SortLink label="QField" sortKey="qfield" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="Location" sortKey="location" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="Total SQFT" sortKey="totalSqft" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="Rate / SQFT" sortKey="companyRatePerSqft" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="Revenue" sortKey="revenue" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="Profit" sortKey="profit" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="Margin %" sortKey="marginPct" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="Status" sortKey="status" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2">
                    <SortLink label="ECD" sortKey="ecd" currentSort={sortKey} currentOrder={order} basePath="/projects" preserveParams={sortPreserveParams} />
                  </th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map((p) => {
                  const revenue =
                    p.totalSqft * Number(p.companyRatePerSqft);
                  const required = projectRequiredPayouts.get(p.id) ?? 0;
                  const profit = revenue - required;
                  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
                  const ecdStatus = getProjectEcdStatus(p.ecd ?? null, p.status);
                  return (
                    <tr key={p.id} className="border-t text-slate-800">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          name="projectIds"
                          value={p.id}
                          form="bulk-invoice-form"
                          className="rounded border-slate-300"
                          aria-label={`Select ${p.projectCode}`}
                        />
                      </td>
                      <td className="px-3 py-2">{p.projectCode}</td>
                      <td className="px-3 py-2">{p.clientName}</td>
                      <td className="px-3 py-2">{p.invoiceNumber?.trim() ?? "—"}</td>
                      <td className="px-3 py-2">{p.qfield ?? "—"}</td>
                      <td className="px-3 py-2">{p.location}</td>
                      <td className="px-3 py-2">{p.totalSqft}</td>
                      <td className="px-3 py-2">
                        {formatRate(Number(p.companyRatePerSqft))}
                      </td>
                      <td className="px-3 py-2">
                        {formatCurrency(revenue)}
                      </td>
                      <td className="px-3 py-2">
                        {formatCurrency(profit)}
                      </td>
                      <td className="px-3 py-2">
                        {revenue > 0 ? `${marginPct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {getProjectStatusLabel(p.status)}
                        {p.archivedAt && (
                          <span className="ml-2 text-xs text-slate-500">(archived)</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.ecd ? (
                          <span className="flex items-center gap-2">
                            {new Date(p.ecd).toLocaleDateString()}
                            {ecdStatus === "overdue" && (
                              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                Overdue
                              </span>
                            )}
                            {ecdStatus === "due-soon" && (
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                Due soon
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 flex flex-wrap gap-2">
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-sm text-slate-700 underline hover:text-slate-900"
                        >
                          Edit
                        </Link>
                        {!showArchived && (
                          <Link
                            href={`/payments?projectId=${p.id}`}
                            className="text-sm text-slate-700 underline hover:text-slate-900"
                          >
                            Log payment
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {paginatedProjects.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No projects yet.{" "}
                      <Link href="/projects" className="font-medium text-slate-900 underline">
                        Add a project
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <span>Per page:</span>
                {[10, 20, 50, 100].map((n) => (
                  <Link
                    key={n}
                    href={`/projects?${new URLSearchParams({ ...projectPreserveParams, sort: sortKey, order, pageSize: String(n), page: "1" }).toString()}`}
                    className={`rounded-lg px-2.5 py-1 text-sm font-medium transition-colors ${pageSize === n ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    {n}
                  </Link>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={`/projects?${new URLSearchParams({ ...projectPreserveParams, sort: sortKey, order, pageSize: String(pageSize), page: String(page - 1) }).toString()}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    ← Prev
                  </Link>
                ) : (
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-400">← Prev</span>
                )}
                <span className="px-2">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={`/projects?${new URLSearchParams({ ...projectPreserveParams, sort: sortKey, order, pageSize: String(pageSize), page: String(page + 1) }).toString()}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-400">Next →</span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}

