/** Compact format for large numbers: 12.5K, 1.2M (no currency symbol) */
export function formatCompact(amount: number, decimals = 1): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(decimals)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(decimals)}K`;
  }
  return amount.toFixed(0);
}

/** Format number with 2 decimal places (no symbol). */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format USD: compact (12.5K, 1.2M) when ≥1K, else full decimals */
export function formatUsdSmart(amount: number, options?: { compactThreshold?: number }): string {
  const threshold = options?.compactThreshold ?? 1_000;
  if (amount >= threshold) {
    return `$${formatCompact(amount)}`;
  }
  return `$${formatCurrency(amount)}`;
}

export function formatRate(rate: number) {
  return rate.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
