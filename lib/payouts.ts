export type PayoutInput = {
  project: { totalSqft: number };
  ratePerSqft: number | string;
  isInternal: boolean;
  managedByFielderId: number | null;
  managerRatePerSqft: number | string | null;
  commissionPercentage: number | string | null;
  payments: { amount: string | number }[];
};

/** Compute total payout owed, amount paid, and pending for a fielder assignment. */
export function calcAssignmentPayout(a: PayoutInput): {
  totalRequired: number;
  paid: number;
  pending: number;
} {
  const sqft = a.project.totalSqft;
  const rate = Number(a.ratePerSqft);
  let totalRequired = 0;
  if (!a.isInternal) {
    if (a.managedByFielderId && a.managerRatePerSqft) {
      totalRequired = rate * sqft;
    } else {
      const base = rate * sqft;
      const commission = a.commissionPercentage ? base * Number(a.commissionPercentage) : 0;
      totalRequired = base + commission;
    }
  }
  const paid = a.payments.reduce((s, p) => s + Number(p.amount), 0);
  const pending = Math.max(totalRequired - paid, 0);
  return { totalRequired, paid, pending };
}
