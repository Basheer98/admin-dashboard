"use client";

type ArchiveAssignmentFormProps = {
  assignmentId: number;
  archivedAt: string | null;
};

export function ArchiveAssignmentForm({ assignmentId, archivedAt }: ArchiveAssignmentFormProps) {
  if (archivedAt) {
    return (
      <form
        method="POST"
        action={`/api/assignments/${assignmentId}/unarchive`}
        onSubmit={(e) => {
          if (!window.confirm("Unarchive this assignment? It will appear in the active list.")) {
            e.preventDefault();
          }
        }}
        className="inline"
      >
        <button
          type="submit"
          className="btn-secondary"
        >
          Unarchive assignment
        </button>
      </form>
    );
  }
  return (
    <form
      method="POST"
      action={`/api/assignments/${assignmentId}/archive`}
      onSubmit={(e) => {
        if (!window.confirm("Archive this assignment? It will be hidden from the active list. You can unarchive it later.")) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <button
        type="submit"
        className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        Archive assignment
      </button>
    </form>
  );
}
