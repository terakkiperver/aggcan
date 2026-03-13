import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { templateId, assetId, entries } = body as {
    templateId: string;
    assetId: string;
    entries: { itemId: string; value: string; isAbnormal: boolean; note?: string }[];
  };

  if (!templateId || !assetId || !entries?.length) {
    return NextResponse.json(
      { error: "templateId, assetId, and entries are required" },
      { status: 400 }
    );
  }

  const templateAsset = await prisma.checklistTemplateAsset.findFirst({
    where: {
      tenantId: session.tenantId,
      templateId,
      assetId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!templateAsset) {
    return NextResponse.json(
      { error: "Seçili makine bu şablona bağlı değil." },
      { status: 400 }
    );
  }

  const submission = await prisma.checklistSubmission.create({
    data: {
      tenantId: session.tenantId,
      templateId,
      assetId,
      submittedBy: session.userId,
      entries: {
        create: entries.map((e) => ({
          itemId: e.itemId,
          value: e.value,
          isAbnormal: e.isAbnormal,
          note: e.note || undefined,
        })),
      },
    },
    include: { entries: true },
  });

  return NextResponse.json(submission, { status: 201 });
}
