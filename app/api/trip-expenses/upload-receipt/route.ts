import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { uploadReceiptToDrive } from "@/lib/drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("receipt");
    const tripId = Number(String(formData.get("tripId") ?? ""));
    const category = String(formData.get("category") ?? "OTHER").trim() || "OTHER";
    const expenseDate = String(formData.get("expenseDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
    const fielderNameInput = String(formData.get("fielderName") ?? "").trim();
    const fielderName = session.role === "fielder" ? session.fielderName : (fielderNameInput || "ADMIN");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Receipt file is required" }, { status: 400 });
    }
    if (!tripId || Number.isNaN(tripId)) {
      return NextResponse.json({ error: "tripId is required" }, { status: 400 });
    }

    const uploaded = await uploadReceiptToDrive({
      file,
      fielderName,
      tripId,
      category,
      expenseDate,
    });

    return NextResponse.json({
      success: true,
      receiptUrl: uploaded.receiptUrl,
      fileId: uploaded.fileId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
