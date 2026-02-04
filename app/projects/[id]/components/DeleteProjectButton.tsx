"use client";

type DeleteProjectButtonProps = {
  projectId: number;
};

export function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  return (
    <form
      method="POST"
      action={`/api/projects/${projectId}/delete`}
      onSubmit={(e) => {
        const ok = window.confirm(
          "Delete this project? This will also delete its fielder assignments and payments. This cannot be undone.",
        );
        if (!ok) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 bg-white px-5 py-2.5 text-base font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
      >
        Delete project
      </button>
    </form>
  );
}

