import { NextResponse } from "next/server";
import { getInvoiceLogo, setInvoiceLogo } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, mime } = await getInvoiceLogo();
  if (!data || !mime) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a PNG or JPG logo file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be under 2 MB." }, { status: 400 });
  }

  const mime = file.type || "image/png";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Use PNG, JPG, or WebP." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  await setInvoiceLogo(buf, mime);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await setInvoiceLogo(null, null);
  return NextResponse.json({ ok: true });
}
