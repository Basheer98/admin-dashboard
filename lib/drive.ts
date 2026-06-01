import { google } from "googleapis";
import { Readable } from "stream";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY");
  }
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

export function getDriveConfigStatus(): {
  configured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!process.env.GOOGLE_PRIVATE_KEY?.trim()) missing.push("GOOGLE_PRIVATE_KEY");
  if (!process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID?.trim()) missing.push("GOOGLE_DRIVE_RECEIPTS_FOLDER_ID");
  return { configured: missing.length === 0, missing };
}

function sanitizeFilenamePart(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function extFromMime(mimeType: string): string {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "application/pdf") return "pdf";
  return "bin";
}

export function validateReceiptFile(file: File): void {
  if (!file || file.size <= 0) {
    throw new Error("Receipt file is required");
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error("Receipt exceeds 10MB size limit");
  }
  if (!ALLOWED_RECEIPT_MIME_TYPES.has(file.type)) {
    throw new Error("Unsupported receipt file type");
  }
}

export function buildReceiptFilename(input: {
  fielderName: string;
  tripId: number;
  category: string;
  expenseDate: string;
  mimeType: string;
}): string {
  const cleanFielder = sanitizeFilenamePart(input.fielderName.toUpperCase() || "FIELDER");
  const cleanCategory = sanitizeFilenamePart(input.category.toUpperCase() || "OTHER");
  const yyyymmdd = (input.expenseDate || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const ext = extFromMime(input.mimeType);
  return `${cleanFielder}_${yyyymmdd}_TRIP${input.tripId}_${cleanCategory}.${ext}`;
}

export async function uploadReceiptToDrive(input: {
  file: File;
  fielderName: string;
  tripId: number;
  category: string;
  expenseDate: string;
}): Promise<{ receiptUrl: string; fileId: string }> {
  validateReceiptFile(input.file);
  const folderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID?.trim();
  if (!folderId) {
    throw new Error("Missing GOOGLE_DRIVE_RECEIPTS_FOLDER_ID");
  }
  const drive = getDriveClient();
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const name = buildReceiptFilename({
    fielderName: input.fielderName,
    tripId: input.tripId,
    category: input.category,
    expenseDate: input.expenseDate,
    mimeType: input.file.type,
  });

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
    },
    media: {
      mimeType: input.file.type,
      body: Readable.from(bytes),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error("Drive upload failed");

  // Simple internal-team setup: share by link so admins can open receipt quickly.
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });

  return {
    fileId,
    receiptUrl: `https://drive.google.com/file/d/${fileId}/view`,
  };
}

export async function testDriveConnection(): Promise<{ ok: true; folderName: string }> {
  const status = getDriveConfigStatus();
  if (!status.configured) {
    throw new Error(`Missing ${status.missing.join(", ")}`);
  }
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID!.trim();
  const folder = await drive.files.get({
    fileId: folderId,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  });
  if (!folder.data.id) throw new Error("Drive folder not found");
  if (folder.data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("GOOGLE_DRIVE_RECEIPTS_FOLDER_ID is not a folder");
  }
  return { ok: true, folderName: folder.data.name ?? "Unknown folder" };
}
