/** Default issuer block — matches AK Products export invoice template. */
export const DEFAULT_INVOICE_ISSUER = {
  issuerName: "AK Products",
  issuerAddress: `Plot no.7, SY.no 186/1, 186/2 Part, 186/3 Part,
NavodayaIndustrial Area, EC Nagar, Cherlapally,
MedchalMalkajgiri, Telangana, 500051`,
  issuerGstin: "36AKGPM8031M1ZT",
  issuerLut: "AD360126009011T",
  serviceDescription:
    "Back-office operational support, data processing, documentation support, quality review assistance, and project coordination services related to telecom projects.",
  sacLine: "SAC Code: 998599 GST: IGST @ 0% (Export of Services)",
  placeOfSupply: "Outside India",
  currencyLabel: "USD",
  exportDeclaration:
    "Supply meant for export under Letter of Undertaking (LUT) without payment of IGST, as per Section 16 of IGST Act, 2017.",
  bankDetails: `Account Name: AK Products
Bank Name: BANK OF BARODA
Account Number: 83270200000008
IFSC: BARB0VJBODU
SWIFT Code: BARBINBBKTB`,
  signatureLabel: "For AK Products",
  signatureSubtext: "Authorized Signatory Signature & Stamp",
};

export type InvoicePdfIssuerSettings = typeof DEFAULT_INVOICE_ISSUER & {
  usdToInrRate: number | null;
};

export function mergeInvoiceIssuerSettings(
  row: Partial<{
    invoiceIssuerName: string | null;
    invoiceIssuerAddress: string | null;
    invoiceIssuerGstin: string | null;
    invoiceIssuerLut: string | null;
    invoiceIssuerServiceDescription: string | null;
    invoiceIssuerSacLine: string | null;
    invoiceIssuerBankDetails: string | null;
    invoiceIssuerExportDeclaration: string | null;
    invoicePlaceOfSupply: string | null;
    usdToInrRate: number | null;
  }> | null,
): InvoicePdfIssuerSettings {
  const d = DEFAULT_INVOICE_ISSUER;
  return {
    issuerName: row?.invoiceIssuerName?.trim() || d.issuerName,
    issuerAddress: row?.invoiceIssuerAddress?.trim() || d.issuerAddress,
    issuerGstin: row?.invoiceIssuerGstin?.trim() || d.issuerGstin,
    issuerLut: row?.invoiceIssuerLut?.trim() || d.issuerLut,
    serviceDescription: row?.invoiceIssuerServiceDescription?.trim() || d.serviceDescription,
    sacLine: row?.invoiceIssuerSacLine?.trim() || d.sacLine,
    placeOfSupply: row?.invoicePlaceOfSupply?.trim() || d.placeOfSupply,
    currencyLabel: d.currencyLabel,
    exportDeclaration: row?.invoiceIssuerExportDeclaration?.trim() || d.exportDeclaration,
    bankDetails: row?.invoiceIssuerBankDetails?.trim() || d.bankDetails,
    signatureLabel: d.signatureLabel,
    signatureSubtext: d.signatureSubtext,
    usdToInrRate: row?.usdToInrRate != null && row.usdToInrRate > 0 ? Number(row.usdToInrRate) : null,
  };
}
