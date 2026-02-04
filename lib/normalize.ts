/** Ensure project code starts with "P." (e.g. 12345 → P.12345, P12345 → P.12345, P.12345 → P.12345). */
export function normalizeProjectCode(input: string): string {
  const s = input.trim();
  if (!s) return s;
  if (/^P\./i.test(s)) return "P." + s.slice(2).trim();
  if (/^P/i.test(s)) return "P." + s.slice(1).trim();
  return "P." + s;
}

/** Store fielder names in uppercase so "Naveen" and "naveen" are the same. */
export function normalizeFielderName(input: string): string {
  return input.trim().toUpperCase();
}
