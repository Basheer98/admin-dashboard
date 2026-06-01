/**
 * Normalize project codes from forms and spreadsheets.
 * Preserves sheet styles: P-029923, PRJ24086, P.143082.
 * Plain numbers still become P.12345.
 */
export function normalizeProjectCode(input: string): string {
  const s = input.trim();
  if (!s) return s;
  if (/^PRJ[\w.-]+$/i.test(s)) return s.replace(/^prj/i, "PRJ");
  if (/^P-[\w.-]+$/i.test(s)) return s;
  if (/^P\./i.test(s)) return "P." + s.slice(2).trim();
  if (/^P[\d.]+$/i.test(s)) return "P." + s.slice(1).trim();
  return "P." + s;
}

/** Store fielder names in uppercase so "Naveen" and "naveen" are the same. */
export function normalizeFielderName(input: string): string {
  return input.trim().toUpperCase();
}
