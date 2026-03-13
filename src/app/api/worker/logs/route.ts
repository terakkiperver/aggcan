import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [faults, hourly, checklists] = await Promise.all([
    prisma.faultReport.findMany({
      where: { reportedBy: session.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        description: true,
        status: true,
        createdAt: true,
        asset: { select: { name: true } },
      },
    }),
    prisma.hourlyReport.findMany({
      where: { workerId: session.userId },
      orderBy: { respondedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        note: true,
        respondedAt: true,
      },
    }),
    prisma.checklistSubmission.findMany({
      where: { submittedBy: session.userId },
      orderBy: { submittedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        template: { select: { name: true } },
      },
    }),
  ]);

  const logs = [
    ...faults.map((f) => ({
      id: f.id,
      type: "fault" as const,
      title: `Arıza: ${f.asset.name}`,
      detail: f.description,
      status: f.status,
      date: f.createdAt,
    })),
    ...hourly.map((h) => ({
      id: h.id,
      type: "hourly" as const,
      title: `Saatlik: ${h.status}`,
      detail: h.note,
      status: h.status,
      date: h.respondedAt,
    })),
    ...checklists.map((c) => ({
      id: c.id,
      type: "checklist" as const,
      title: `Kontrol: ${c.template.name}`,
      detail: null,
      status: c.status,
      date: c.submittedAt,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return NextResponse.json(logs);
}
