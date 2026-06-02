const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ones[n] ?? "";
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${tens[t] ?? ""}${o ? ` ${ones[o]}` : ""}`.trim();
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ones[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ").trim();
}

function indianGroup(n: number, scale: string): string {
  if (!n) return "";
  return `${threeDigits(n)} ${scale}`.trim();
}

/** Indian numbering words for rupee amount (paise as NN/100 Only). */
export function amountInWordsInr(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Only";

  const crore = Math.floor(rupees / 1_00_00_000);
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1000);
  const hundred = rupees % 1000;

  const parts = [
    indianGroup(crore, "Crore"),
    indianGroup(lakh, "Lakh"),
    indianGroup(thousand, "Thousand"),
    hundred ? threeDigits(hundred) : "",
  ].filter(Boolean);

  const words = parts.join(" ").trim() || "Zero";
  const paisePart = paise > 0 ? ` and ${paise}/100` : "";
  return `${words}${paisePart} Only`;
}
