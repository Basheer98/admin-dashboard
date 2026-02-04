/** Due soon = within 7 days from today. */
const DUE_SOON_DAYS = 7;

export type DueStatus = "overdue" | "due-soon" | null;

export function getDueDateStatus(dueDate: string | null): DueStatus {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= DUE_SOON_DAYS) return "due-soon";
  return null;
}

/** Project ECD status: only overdue/due-soon when project is not completed. */
export function getProjectEcdStatus(
  ecd: string | null,
  status: string,
): DueStatus {
  if (!ecd || status === "COMPLETED") return null;
  return getDueDateStatus(ecd);
}
