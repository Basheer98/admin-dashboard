export const PROJECT_STATUS_VALUES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type ProjectStatusValue = (typeof PROJECT_STATUS_VALUES)[number];

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export function getProjectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status] ?? status;
}
