export const PROJECT_STATUS_VALUES = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"] as const;
export type ProjectStatusValue = (typeof PROJECT_STATUS_VALUES)[number];

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Assigned",
  NOT_STARTED: "Assigned", // legacy alias
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  COMPLETED: "Completed",
};

export function getProjectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status] ?? status;
}
