export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  USER_ROLE_LABELS,
} from "@/lib/types/index";
import type { TaskType, TaskStatus, UserRole } from "@/lib/types/index";

const AVATAR_COLORS = ["#f0a500", "#3498db", "#2ecc71", "#9b59b6", "#e74c3c"];

const EVENT_CONFIG = {
  start: { label: "Göreve Başladı", color: "#3498db" },
  complete: { label: "Tamamladı", color: "#2ecc71" },
  fault: { label: "Arıza Bildirimi", color: "#e74c3c" },
} as const;

type TimelineEvent = {
  time: Date;
  type: keyof typeof EVENT_CONFIG;
  workerName: string;
  assetName: string;
  detail: string;
};

export default async function WorkersPage() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">
          Tenant bulunamadı
        </p>
      </div>
    );
  }

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

  const [workers, workerDurations, todayTasks, todayFaults] = await Promise.all(
    [
      prisma.user.findMany({
        where: { tenantId: tenant.id, role: "worker", isActive: true },
        include: {
          assignedTasks: {
            where: { status: "in_progress" },
            include: { asset: true },
            take: 1,
          },
          taskAssignments: {
            where: { task: { status: "in_progress" } },
            include: { task: { include: { asset: true } } },
            take: 1,
          },
        },
      }),
      prisma.taskAssignment.groupBy({
        by: ["userId"],
        where: {
          tenantId: tenant.id,
          task: {
            status: "completed",
            completedAt: { gte: startOfDay, lt: endOfDay },
          },
        },
        _count: true,
      }),
      prisma.task.findMany({
        where: {
          tenantId: tenant.id,
          OR: [
            { startedAt: { gte: startOfDay, lt: endOfDay } },
            { completedAt: { gte: startOfDay, lt: endOfDay } },
          ],
        },
        include: {
          asset: true,
          assignee: true,
          taskAssignments: {
            include: {
              user: {
                select: { id: true, fullName: true },
              },
            },
          },
        },
      }),
      prisma.faultReport.findMany({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
        include: { asset: true, reporter: true },
      }),
    ]
  );

  const durationMap = new Map(
    workerDurations.map((w) => [
      w.userId,
      {
        count: w._count,
        minutes: 0,
      },
    ])
  );

  const SHIFT_MINUTES = 480;

  const workerData = workers.map((worker, i) => {
    const current = worker.assignedTasks[0] ?? worker.taskAssignments[0]?.task;
    const stats = durationMap.get(worker.id) ?? { count: 0, minutes: 0 };

    let activeMinutes = stats.minutes;
    if (current?.startedAt) {
      const elapsed = Math.floor(
        (now.getTime() - new Date(current.startedAt).getTime()) / 60_000
      );
      activeMinutes += Math.max(0, elapsed);
    }

    const efficiency = Math.min(
      Math.round((activeMinutes / SHIFT_MINUTES) * 100),
      100
    );

    return {
      ...worker,
      currentTask: current,
      completedCount: stats.count,
      activeMinutes,
      efficiency,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    };
  });

  const events: TimelineEvent[] = [];

  for (const task of todayTasks) {
    if (task.startedAt && task.startedAt >= startOfDay) {
      events.push({
        time: task.startedAt,
        type: "start",
        workerName:
          task.taskAssignments.length > 0
            ? task.taskAssignments.map((ta) => ta.user.fullName).join(", ")
            : task.assignee.fullName,
        assetName: task.asset.name,
        detail:
          TASK_TYPE_LABELS[task.taskType as TaskType] ?? task.taskType,
      });
    }
    if (task.completedAt && task.completedAt >= startOfDay) {
      events.push({
        time: task.completedAt,
        type: "complete",
        workerName:
          task.taskAssignments.length > 0
            ? task.taskAssignments.map((ta) => ta.user.fullName).join(", ")
            : task.assignee.fullName,
        assetName: task.asset.name,
        detail:
          TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status,
      });
    }
  }

  for (const fault of todayFaults) {
    events.push({
      time: fault.createdAt,
      type: "fault",
      workerName: fault.reporter.fullName,
      assetName: fault.asset.name,
      detail:
        fault.description.length > 40
          ? fault.description.slice(0, 40) + "…"
          : fault.description,
    });
  }

  events.sort((a, b) => b.time.getTime() - a.time.getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          Personel Takibi
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          Gün boyu faaliyet ve verimlilik ·{" "}
          {format(now, "d MMMM yyyy", { locale: tr })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide">
            Anlık Durum
          </h2>
          <div className="space-y-3">
            {workerData.map((worker) => (
              <div
                key={worker.id}
                className="rounded-md border border-border/50 bg-secondary/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className="flex size-9 items-center justify-center rounded-full font-mono text-xs font-semibold"
                      style={{
                        backgroundColor: worker.color,
                        color: "#000",
                      }}
                    >
                      {worker.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${
                        worker.currentTask ? "bg-[#2ecc71]" : "bg-[#8892a4]"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-medium">
                        {worker.fullName}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {USER_ROLE_LABELS[worker.role as UserRole] ??
                          worker.role}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {worker.currentTask
                        ? worker.currentTask.asset.name
                        : "Boşta"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-[#2ecc71]">
                      {worker.completedCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      görev
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Verimlilik
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {worker.efficiency}% · {worker.activeMinutes}dk /{" "}
                      {SHIFT_MINUTES}dk
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${worker.efficiency}%`,
                        backgroundColor:
                          worker.efficiency >= 70
                            ? "#2ecc71"
                            : worker.efficiency >= 40
                              ? "#f0a500"
                              : "#e74c3c",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {workerData.length === 0 && (
              <p className="py-6 text-center font-mono text-xs text-muted-foreground">
                Kayıtlı personel yok
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide">
            Bugünkü Aktivite
          </h2>
          <div className="space-y-0">
            {events.map((event, i) => {
              const cfg = EVENT_CONFIG[event.type];
              return (
                <div key={i} className="relative flex gap-3 pb-4">
                  {i < events.length - 1 && (
                    <div className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-border" />
                  )}
                  <div className="relative mt-1.5 shrink-0">
                    <div
                      className="size-[15px] rounded-full border-2 border-card"
                      style={{ backgroundColor: cfg.color }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {format(event.time, "HH:mm")}
                      </span>
                      <span className="font-mono text-[12px] font-medium">
                        {event.workerName}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-[12px]">
                        {event.assetName}
                      </span>
                      <span
                        className="inline-flex rounded-full px-1.5 py-0.5 font-mono text-[9px] font-medium"
                        style={{
                          backgroundColor: cfg.color + "20",
                          color: cfg.color,
                        }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {event.detail}
                    </p>
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <p className="py-6 text-center font-mono text-xs text-muted-foreground">
                Bugün henüz aktivite yok
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
