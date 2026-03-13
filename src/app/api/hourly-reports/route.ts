import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const workerId = searchParams.get("workerId");

  const where: Record<string, unknown> = { tenantId: session.tenantId };
  if (workerId) where.workerId = workerId;

  const reports = await prisma.hourlyReport.findMany({
    where,
    include: {
      worker: { select: { id: true, fullName: true } },
    },
    orderBy: { respondedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(reports);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { status, note } = body as { status: string; note?: string };

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const now = new Date();
  const promptedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

  const report = await prisma.hourlyReport.create({
    data: {
      tenantId: session.tenantId,
      workerId: session.userId,
      status,
      note: note || undefined,
      promptedAt,
      respondedAt: now,
    },
  });

  return NextResponse.json(report, { status: 201 });
}
