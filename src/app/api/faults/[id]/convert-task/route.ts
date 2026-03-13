import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

function normalizeDateInput(input?: string): Date | undefined {
  if (!input) return undefined;
  const candidate = new Date(input);
  if (Number.isNaN(candidate.getTime())) return undefined;
  return candidate;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    if (session.role === "worker") {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
    }

    const { id } = await params;
    const {
      assignedToIds,
      taskType,
      priority,
      description,
      deadlineAt,
    }: {
      assignedToIds?: string[];
      taskType?: string;
      priority?: string;
      description?: string;
      deadlineAt?: string;
    } = await request.json();

    const normalizedAssigneeIds =
      Array.isArray(assignedToIds) && assignedToIds.length > 0
        ? [...new Set(assignedToIds.filter((v) => typeof v === "string" && v.trim()))]
        : [];

    if (normalizedAssigneeIds.length === 0) {
      return NextResponse.json(
        { error: "En az bir personel seçilmelidir." },
        { status: 400 }
      );
    }

    const fault = await prisma.faultReport.findFirst({
      where: {
        id,
        tenantId: session.tenantId,
      },
      select: {
        id: true,
        assetId: true,
        description: true,
        status: true,
      },
    });

    if (!fault) {
      return NextResponse.json({ error: "Arıza bulunamadı." }, { status: 404 });
    }

    const assignees = await prisma.user.findMany({
      where: {
        id: { in: normalizedAssigneeIds },
        tenantId: session.tenantId,
        isActive: true,
        role: { in: ["worker", "foreman"] },
      },
      select: { id: true },
    });

    if (assignees.length !== normalizedAssigneeIds.length) {
      return NextResponse.json(
        { error: "Görev yalnızca aktif personel veya ustabaşına atanabilir." },
        { status: 400 }
      );
    }

    const faultTag = `[Arıza:${fault.id}]`;
    const existingTask = await prisma.task.findFirst({
      where: {
        tenantId: session.tenantId,
        source: "manual",
        assetId: fault.assetId,
        description: { contains: faultTag },
        status: { in: ["pending", "in_progress", "paused"] },
      },
      select: { id: true },
    });

    if (existingTask) {
      return NextResponse.json(
        { error: "Bu arıza için zaten açık bir görev var." },
        { status: 409 }
      );
    }

    const normalizedTaskType =
      typeof taskType === "string" && taskType.trim() ? taskType : "fault_repair";
    const normalizedPriority =
      typeof priority === "string" && priority.trim() ? priority : "normal";
    const parsedDeadlineAt = normalizeDateInput(deadlineAt);
    if (deadlineAt && !parsedDeadlineAt) {
      return NextResponse.json(
        { error: "Geçersiz termin tarihi." },
        { status: 400 }
      );
    }

    const taskDescription =
      typeof description === "string" && description.trim()
        ? `${faultTag} ${description.trim()}`
        : `${faultTag} ${fault.description}`;

    const primaryAssigneeId = normalizedAssigneeIds[0];

    const result = await prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          tenantId: session.tenantId,
          assetId: fault.assetId,
          assignedTo: primaryAssigneeId,
          createdBy: session.userId,
          taskType: normalizedTaskType,
          source: "manual",
          priority: normalizedPriority,
          description: taskDescription,
          deadlineAt: parsedDeadlineAt,
          taskAssignments: {
            createMany: {
              data: normalizedAssigneeIds.map((userId) => ({
                tenantId: session.tenantId,
                userId,
              })),
            },
          },
        },
        include: {
          asset: { include: { category: true } },
          taskAssignments: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  username: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (fault.status === "open") {
        await tx.faultReport.update({
          where: { id: fault.id },
          data: { status: "in_progress" },
        });
      }

      return createdTask;
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
