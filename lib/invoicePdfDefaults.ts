/** Company block shown on client invoice PDFs. */
export const DEFAULT_INVOICE_ISSUER = {
  issuerName: "UrbanLink Networks LLC",
  issuerAddress: "5600 W 133rd TER Apt 718\nOverland Park, KS 66209",
};

export type InvoicePdfIssuerSettings = {
  issuerName: string;
  issuerAddress: string;
  logo: Buffer | null;
  logoMime: string | null;
};

export function mergeInvoiceIssuerSettings(
  row: Partial<{
    invoiceIssuerName: string | null;
    invoiceIssuerAddress: string | null;
  }> | null,
  logo?: { data: Buffer | null; mime: string | null },
): InvoicePdfIssuerSettings {
  const d = DEFAULT_INVOICE_ISSUER;
  return {
    issuerName: row?.invoiceIssuerName?.trim() || d.issuerName,
    issuerAddress: row?.invoiceIssuerAddress?.trim() || d.issuerAddress,
    logo: logo?.data ?? null,
    logoMime: logo?.mime ?? null,
  };
}
