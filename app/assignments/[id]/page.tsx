import { getAssignmentById, getAllAssignments } from "@/lib/db";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { EditAssignmentForm } from "../components/EditAssignmentForm";
import { DeleteAssignmentButton } from "./components/DeleteAssignmentButton";
import { ArchiveAssignmentForm } from "./components/ArchiveAssignmentForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditAssignmentPage({ params }: PageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [assignment, allAssignments] = await Promise.all([
    getAssignmentById(id),
    getAllAssignments({ includeArchived: true }),
  ]);

  if (!assignment) {
    return (
      <SidebarLayout title="Assignment not found" current="assignments">
        <p className="text-sm text-zinc-300">Assignment not found.</p>
      </SidebarLayout>
    );
  }

  const projectAssignments = allAssignments.filter((a) => a.id !== id);

  return (
    <SidebarLayout title="Edit fielder assignment" current="assignments" backLink={{ href: "/assignments", label: "Fielders" }} breadcrumbs={[{ label: "Fielders", href: "/assignments" }, { label: `${assignment.project.projectCode} – ${assignment.fielderName}` }]}>
      <div className="flex flex-1 flex-col gap-6">
        <section className="card p-6">
          <div className="mb-4">
            <p className="text-sm text-zinc-400">
              Project:{" "}
              <span className="font-medium text-zinc-100">
                {assignment.project.projectCode} – {assignment.project.clientName}
              </span>
            </p>
          </div>
          <EditAssignmentForm
            assignment={assignment}
            projectAssignments={projectAssignments}
          />

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
            <DeleteAssignmentButton assignmentId={assignment.id} />
            <ArchiveAssignmentForm assignmentId={assignment.id} archivedAt={assignment.archivedAt} />
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}

