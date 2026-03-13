import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const unit = searchParams.get("unit");

    const tasks = await prisma.task.findMany({
      where: {
        tenantId: session.tenantId,
        ...(status ? { status } : {}),
        source: { not: "daily_operation" },
        asset: {
          ...(unit ? { category: { code: unit } } : {}),
        },
      },
      include: {
        asset: { include: { category: true } },
        assignee: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
          },
        },
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const { assetId, assignedTo, assignedToIds, taskType, priority, description, deadlineAt } =
      await request.json();
    const normalizedAssigneeIds: string[] =
      Array.isArray(assignedToIds) && assignedToIds.length > 0
        ? [...new Set(assignedToIds.filter((v) => typeof v === "string" && v.trim()))]
        : assignedTo
          ? [assignedTo]
          : [];

    if (!assetId || normalizedAssigneeIds.length === 0) {
      return NextResponse.json(
        { error: "Zorunlu alanlar eksik." },
        { status: 400 }
      );
    }
    const normalizedTaskType =
      typeof taskType === "string" && taskType.trim() ? taskType : "operation";

    let parsedDeadlineAt: Date | undefined;
    if (deadlineAt) {
      const candidate = new Date(deadlineAt);
      if (Number.isNaN(candidate.getTime())) {
        return NextResponse.json(
          { error: "Geçersiz termin tarihi." },
          { status: 400 }
        );
      }
      parsedDeadlineAt = candidate;
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

    const primaryAssigneeId = normalizedAssigneeIds[0];
    const task = await prisma.task.create({
      data: {
        tenantId: session.tenantId,
        assetId,
        assignedTo: primaryAssigneeId,
        createdBy: session.userId,
        taskType: normalizedTaskType,
        source: "manual",
        priority: priority || "normal",
        description,
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
        assignee: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
          },
        },
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

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
