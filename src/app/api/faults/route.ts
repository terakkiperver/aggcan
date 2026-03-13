import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const assetId = searchParams.get("assetId");

  const where: Record<string, unknown> = { tenantId: session.tenantId };
  if (status) where.status = status;
  if (assetId) where.assetId = assetId;

  const faults = await prisma.faultReport.findMany({
    where,
    include: {
      asset: { select: { id: true, name: true, code: true } },
      reporter: { select: { id: true, fullName: true } },
      photos: { select: { id: true, storagePath: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(faults);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const assetId = formData.get("assetId") as string;
  const description = formData.get("description") as string;
  const partName = formData.get("partName") as string | null;
  const operationType = formData.get("operationType") as string | null;

  if (!assetId || !description) {
    return NextResponse.json({ error: "assetId and description are required" }, { status: 400 });
  }
  if (operationType && !["blocks_work", "no_block"].includes(operationType)) {
    return NextResponse.json({ error: "invalid operationType" }, { status: 400 });
  }

  const fault = await prisma.faultReport.create({
    data: {
      tenantId: session.tenantId,
      assetId,
      reportedBy: session.userId,
      description,
      partName: partName || undefined,
      operationType: operationType || undefined,
      status: "open",
      faultStart: new Date(),
    },
  });

  const photoFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "photo" && value instanceof File && value.size > 0) {
      photoFiles.push(value);
    }
  }

  if (photoFiles.length > 0) {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    for (const file of photoFiles) {
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `${randomUUID()}.${ext}`;
      const filepath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filepath, buffer);

      await prisma.photo.create({
        data: {
          tenantId: session.tenantId,
          entityType: "fault",
          entityId: fault.id,
          storagePath: `/uploads/${filename}`,
          fileSize: buffer.length,
          uploadedBy: session.userId,
        },
      });
    }
  }

  return NextResponse.json(fault, { status: 201 });
}
