"use client";

type ArchiveProjectFormProps = {
  projectId: number;
  archivedAt: string | null;
};

export function ArchiveProjectForm({ projectId, archivedAt }: ArchiveProjectFormProps) {
  if (archivedAt) {
    return (
      <form
        method="POST"
        action={`/api/projects/${projectId}/unarchive`}
        onSubmit={(e) => {
          if (!window.confirm("Unarchive this project? It will appear in the active projects list.")) {
            e.preventDefault();
          }
        }}
        className="inline"
      >
        <button
          type="submit"
          className="btn-secondary"
        >
          Unarchive project
        </button>
      </form>
    );
  }
  return (
    <form
      method="POST"
      action={`/api/projects/${projectId}/archive`}
      onSubmit={(e) => {
        if (!window.confirm("Archive this project? It will be hidden from the active list. You can unarchive it later.")) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <button
        type="submit"
        className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        Archive project
      </button>
    </form>
  );
}
