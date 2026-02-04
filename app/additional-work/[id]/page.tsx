import { getAdditionalWorkById, getAssignmentsByProjectId } from "@/lib/db";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import Link from "next/link";
import { AdditionalWorkForm } from "../components/AdditionalWorkForm";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function EditAdditionalWorkPage({ params, searchParams }: PageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const row = await getAdditionalWorkById(id);
  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const error = sp.error === "missing";

  if (!row) {
    return (
      <SidebarLayout title="Edit additional work" current="additional">
        <div className="flex flex-1 flex-col gap-6">
          <p className="text-sm text-slate-700">Additional work not found.</p>
          <Link href="/additional-work" className="text-sm text-slate-700 underline hover:text-slate-900">
            Back to additional work
          </Link>
        </div>
      </SidebarLayout>
    );
  }

  const prefetchedProject = row.project
    ? {
        id: row.project.id,
        projectCode: row.project.projectCode,
        clientName: row.project.clientName,
        status: row.project.status,
        ecd: row.project.ecd,
      }
    : null;
  const projectAssignments = row.ourProjectId
    ? await getAssignmentsByProjectId(row.ourProjectId, { includeArchived: true })
    : [];
  const prefetchedAssignments = projectAssignments.map((a) => ({
    id: a.id,
    fielderName: a.fielderName,
  }));

  return (
    <SidebarLayout title="Edit additional work" current="additional" backLink={{ href: "/additional-work", label: "Additional work" }}>
      <div className="flex flex-1 flex-col gap-6">
        <Breadcrumbs items={[{ label: "Additional work", href: "/additional-work" }, { label: `${row.type === "CORRECTION" ? "Correction" : "Additional fielding"} – ${row.projectNumber}` }]} />
        {saved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Changes saved.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Please enter a project number.
          </div>
        )}
        <nav className="text-sm">
          <Link href="/additional-work" className="text-slate-700 hover:underline hover:text-slate-900">
            ← Back to additional work
          </Link>
        </nav>
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Edit {row.type === "CORRECTION" ? "correction" : "additional fielding"}
          </h2>
          <AdditionalWorkForm
            mode="edit"
            initialType={row.type}
            initialProjectNumber={row.projectNumber}
            initialOurProjectId={row.ourProjectId}
            initialAssignedFielderAssignmentId={row.assignedFielderAssignmentId}
            initialDistance={row.distance}
            initialRateForEntireJob={row.rateForEntireJob}
            initialAmount={row.amount}
            initialDueDate={row.dueDate}
            initialCompletedAt={row.completedAt}
            initialStatus={row.status}
            initialNotes={row.notes}
            prefetchedProject={prefetchedProject}
            prefetchedAssignments={prefetchedAssignments}
            action={`/api/additional-work/${id}`}
            submitLabel="Save changes"
          />
        </section>
      </div>
    </SidebarLayout>
  );
}
