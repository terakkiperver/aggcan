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

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending:
    "bg-[color-mix(in_srgb,var(--toys-orange)_12%,transparent)] text-[var(--toys-orange)] border-[color-mix(in_srgb,var(--toys-orange)_25%,transparent)]",
  in_progress:
    "bg-[color-mix(in_srgb,var(--toys-blue)_12%,transparent)] text-[var(--toys-blue)] border-[color-mix(in_srgb,var(--toys-blue)_25%,transparent)]",
  completed:
    "bg-[color-mix(in_srgb,var(--toys-green)_12%,transparent)] text-[var(--toys-green)] border-[color-mix(in_srgb,var(--toys-green)_25%,transparent)]",
  fault:
    "bg-[color-mix(in_srgb,var(--toys-red)_12%,transparent)] text-[var(--toys-red)] border-[color-mix(in_srgb,var(--toys-red)_25%,transparent)]",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const AVATAR_COLORS = ["#f0a500", "#3498db", "#2ecc71", "#9b59b6", "#e74c3c"];

export default async function DashboardPage() {
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

  const [
    activeTaskCount,
    openFaultCount,
    completedTodayCount,
    workers,
    recentTasks,
  ] = await Promise.all([
    prisma.task.count({
      where: { tenantId: tenant.id, status: "in_progress" },
    }),
    prisma.faultReport.count({
      where: { tenantId: tenant.id, status: "open" },
    }),
    prisma.task.count({
      where: {
        tenantId: tenant.id,
        status: "completed",
        completedAt: { gte: startOfDay, lt: endOfDay },
      },
    }),
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
    prisma.task.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        asset: { include: { parent: true } },
        assignee: true,
        taskAssignments: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const activeWorkerCount = workers.filter(
    (w) => w.assignedTasks.length > 0 || w.taskAssignments.length > 0
  ).length;

  const workerCompletedToday = await prisma.taskAssignment.groupBy({
    by: ["userId"],
    where: {
      tenantId: tenant.id,
      task: {
        status: "completed",
        completedAt: { gte: startOfDay, lt: endOfDay },
      },
    },
    _count: true,
  });
  const completedMap = new Map(
    workerCompletedToday.map((w) => [w.userId, w._count])
  );

  const categories = await prisma.assetCategory.findMany({
    where: { tenantId: tenant.id, code: { in: ["U1", "U2", "U3"] } },
    orderBy: { displayOrder: "asc" },
  });

  const unitStats = await Promise.all(
    categories.map(async (cat) => {
      const assetIds = await prisma.asset.findMany({
        where: { tenantId: tenant.id, categoryId: cat.id, isDeleted: false },
        select: { id: true },
      });
      const ids = assetIds.map((a) => a.id);
      const [active, faults] = await Promise.all([
        prisma.task.count({
          where: { assetId: { in: ids }, status: "in_progress" },
        }),
        prisma.faultReport.count({
          where: { assetId: { in: ids }, status: "open" },
        }),
      ]);
      return { unit: { id: cat.id, name: `${cat.code} — ${cat.name}` }, active, faults, total: ids.length };
    })
  );

  const stats = [
    {
      label: "Aktif Görev",
      value: activeTaskCount,
      colorVar: "var(--toys-orange)",
      desc: "Devam eden görevler",
    },
    {
      label: "Arıza",
      value: openFaultCount,
      colorVar: "var(--toys-red)",
      desc: "Açık arıza bildirimi",
    },
    {
      label: "Tamamlanan",
      value: completedTodayCount,
      colorVar: "var(--toys-green)",
      desc: "Bugün tamamlanan",
    },
    {
      label: "Çalışan",
      value: activeWorkerCount,
      colorVar: "var(--toys-blue)",
      desc: "Aktif personel sayısı",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            Gösterge Paneli
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {format(now, "d MMMM yyyy, EEEE", { locale: tr })}
          </p>
        </div>
        <div
          className="flex items-center gap-2 rounded-full border px-4 py-1.5"
          style={{
            borderColor: "color-mix(in srgb, var(--toys-green) 30%, transparent)",
            background: "color-mix(in srgb, var(--toys-green) 10%, transparent)",
          }}
        >
          <span className="relative flex size-2">
            <span
              className="absolute inline-flex size-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: "var(--toys-green)" }}
            />
            <span
              className="relative inline-flex size-2 rounded-full"
              style={{ backgroundColor: "var(--toys-green)" }}
            />
          </span>
          <span
            className="font-mono text-xs font-medium"
            style={{ color: "var(--toys-green)" }}
          >
            TESİS ÇALIŞIYOR
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-lg border border-border bg-card p-4"
          >
            <div
              className="absolute left-0 right-0 top-0 h-0.5"
              style={{ backgroundColor: s.colorVar }}
            />
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
            <div
              className="my-1 font-mono text-3xl font-semibold"
              style={{ color: s.colorVar }}
            >
              {s.value}
            </div>
            <div className="text-[11px] text-muted-foreground">{s.desc}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide">
            Son Görevler
          </h2>
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-md border border-border/50 bg-secondary/30 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-[13px] font-medium">
                      {task.asset.name}
                    </span>
                    {task.asset.parent && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {task.asset.parent.name}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <span>
                      {TASK_TYPE_LABELS[task.taskType as TaskType] ??
                        task.taskType}
                    </span>
                    <span>·</span>
                    <span>{format(task.createdAt, "HH:mm")}</span>
                    <span>·</span>
                    <span>
                      {(task.taskAssignments.length > 0
                        ? task.taskAssignments.map((ta) => ta.user.fullName)
                        : [task.assignee.fullName]
                      ).join(", ")}
                    </span>
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium ${
                    STATUS_BADGE_CLASSES[task.status] ?? ""
                  }`}
                >
                  {TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status}
                </span>
              </div>
            ))}
            {recentTasks.length === 0 && (
              <p className="py-6 text-center font-mono text-xs text-muted-foreground">
                Henüz görev yok
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide">
            Personel Durumu
          </h2>
          <div className="space-y-3">
            {workers.map((worker, i) => {
              const current =
                worker.assignedTasks[0] ?? worker.taskAssignments[0]?.task;
              const done = completedMap.get(worker.id) ?? 0;
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <div
                  key={worker.id}
                  className="flex items-center gap-3 rounded-md border border-border/50 bg-secondary/30 px-3 py-2.5"
                >
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold"
                    style={{ backgroundColor: color, color: "#000" }}
                  >
                    {worker.fullName.charAt(0).toUpperCase()}
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
                      {current ? current.asset.name : "Boşta"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-mono text-lg font-semibold"
                      style={{ color: "var(--toys-green)" }}
                    >
                      {done}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      tamamlanan
                    </div>
                  </div>
                </div>
              );
            })}
            {workers.length === 0 && (
              <p className="py-6 text-center font-mono text-xs text-muted-foreground">
                Kayıtlı personel yok
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide">
          Ünite Özeti
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {unitStats.map(({ unit, active, faults, total }) => (
            <div
              key={unit.id}
              className="rounded-md border border-border/50 bg-secondary/30 p-4"
            >
              <div className="mb-3 font-mono text-sm font-semibold">
                {unit.name}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Aktif Görev
                  </span>
                  <span
                    className="font-mono text-sm font-medium"
                    style={{ color: "var(--toys-blue)" }}
                  >
                    {active}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Açık Arıza
                  </span>
                  <span
                    className="font-mono text-sm font-medium"
                    style={{ color: "var(--toys-red)" }}
                  >
                    {faults}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Toplam Ekipman
                  </span>
                  <span className="font-mono text-sm font-medium">
                    {total}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {unitStats.length === 0 && (
            <p className="col-span-3 py-6 text-center font-mono text-xs text-muted-foreground">
              Ünite verisi yok
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
