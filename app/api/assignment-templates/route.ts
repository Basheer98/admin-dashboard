import { NextResponse } from "next/server";
import { getAllAssignmentTemplates, createAssignmentTemplate } from "@/lib/db";

export async function GET() {
  const templates = await getAllAssignmentTemplates();
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const items = Array.isArray(body.items) ? body.items : [];
    if (!name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 },
      );
    }
    const parsedItems = items.map((it: unknown) => {
      if (!it || typeof it !== "object") return null;
      const o = it as Record<string, unknown>;
      return {
        fielderName: typeof o.fielderName === "string" ? o.fielderName.trim() : "",
        ratePerSqft: Number(o.ratePerSqft) || 0,
        commissionPercentage:
          o.commissionPercentage != null ? Number(o.commissionPercentage) : null,
        isInternal: Boolean(o.isInternal),
        managerFielderName:
          typeof o.managerFielderName === "string"
            ? o.managerFielderName.trim() || null
            : null,
        managerRatePerSqft:
          o.managerRatePerSqft != null ? Number(o.managerRatePerSqft) : null,
        managerCommissionShare:
          o.managerCommissionShare != null
            ? Number(o.managerCommissionShare)
            : null,
      };
    }).filter((it) => it && it.fielderName);
    if (parsedItems.length === 0) {
      return NextResponse.json(
        { error: "At least one fielder item is required" },
        { status: 400 },
      );
    }
    const id = await createAssignmentTemplate({ name, items: parsedItems });
    return NextResponse.json({ id });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 },
    );
  }
}
