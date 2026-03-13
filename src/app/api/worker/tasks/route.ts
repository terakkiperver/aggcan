import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

  const [tasks, dailyOperations] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [
          { assignedTo: session.userId },
          { taskAssignments: { some: { userId: session.userId } } },
        ],
        status: { in: ["pending", "in_progress", "paused"] },
        source: { not: "daily_operation" },
      },
      include: {
        asset: { select: { name: true, code: true } },
        creator: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.dailyOperation.findMany({
      where: {
        assignments: { some: { userId: session.userId } },
        status: { in: ["pending", "in_progress", "paused"] },
        deadlineAt: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        asset: { select: { name: true, code: true } },
        creator: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const normalizedDailyOperations = dailyOperations.map((op) => ({
    id: op.id,
    kind: "daily_operation" as const,
    taskType: "operation",
    priority: "normal",
    status: op.status,
    description: op.description,
    createdAt: op.createdAt,
    asset: op.asset,
    creator: op.creator,
  }));

  const normalizedTasks = tasks.map((task) => ({
    ...task,
    kind: "task" as const,
  }));

  const combinedTasks = [...normalizedTasks, ...normalizedDailyOperations];

  const sorted = combinedTasks.sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );

  return NextResponse.json(sorted);
}
