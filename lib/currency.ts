import { getSettings } from "./db";

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

/** Format amount in USD; if settings have usdToInrRate, optionally append INR equivalent. */
export function formatWithInr(
  amountUsd: number,
  options?: { showInr?: boolean },
): string {
  const usdStr = `$${formatCurrency(amountUsd)}`;
  if (!options?.showInr) return usdStr;
  const settings = getSettings();
  if (settings.usdToInrRate == null) return usdStr;
  const inr = amountUsd * settings.usdToInrRate;
  return `${usdStr} (₹${formatCurrency(inr, "INR")})`;
}