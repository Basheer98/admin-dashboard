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

/** Format USD: compact (12.5K, 1.2M) when ≥1K, else full decimals */
export function formatUsdSmart(amount: number, options?: { compactThreshold?: number }): string {
  const threshold = options?.compactThreshold ?? 1_000;
  if (amount >= threshold) {
    return `$${formatCompact(amount)}`;
  }
  return `$${formatCurrency(amount)}`;
}

export function formatCurrency(amount: number, currency: "USD" | "INR" = "USD") {
  const locale = currency === "INR" ? "en-IN" : undefined;
  return amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRate(rate: number) {
  return rate.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/** Format amount in USD; if options.usdToInrRate is set and showInr, append INR equivalent. */
export function formatWithInr(
  amountUsd: number,
  options?: { showInr?: boolean; usdToInrRate?: number | null },
): string {
  const usdStr = `$${formatCurrency(amountUsd)}`;
  if (!options?.showInr || options.usdToInrRate == null) return usdStr;
  const inr = amountUsd * options.usdToInrRate;
  return `${usdStr} (₹${formatCurrency(inr, "INR")})`;
}