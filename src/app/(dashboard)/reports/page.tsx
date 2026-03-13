import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { TASK_TYPE_LABELS } from "@/lib/types/index";
import type { TaskType } from "@/lib/types/index";
import { Printer } from "lucide-react";

const TASK_TYPES: TaskType[] = [
  "operation",
  "fault_repair",
  "maintenance",
  "cleaning",
  "stock_check",
];

export default async function ReportsPage() {
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
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    faultTasks,
    recentFaults,
    workers,
    workerStats,
    todayTasks,
  ] = await Promise.all([
    prisma.task.count({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
    }),
    prisma.task.count({
      where: {
        tenantId: tenant.id,
        status: "completed",
        completedAt: { gte: startOfDay, lt: endOfDay },
      },
    }),
    prisma.task.count({
      where: { tenantId: tenant.id, status: "in_progress" },
    }),
    prisma.task.count({
      where: { tenantId: tenant.id, status: "pending" },
    }),
    prisma.task.count({
      where: { tenantId: tenant.id, status: "fault" },
    }),
    prisma.faultReport.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { asset: true },
    }),
    prisma.user.findMany({
      where: { tenantId: tenant.id, role: "worker", isActive: true },
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
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      include: { asset: { select: { id: true, parentId: true } } },
    }),
  ]);

  const statMap = new Map(
    workerStats.map((s) => [s.userId, s._count])
  );

  const units = await prisma.asset.findMany({
    where: { tenantId: tenant.id, parentId: null, isDeleted: false },
    orderBy: { code: "asc" },
  });

  const childAssets = await prisma.asset.findMany({
    where: {
      tenantId: tenant.id,
      parentId: { in: units.map((u) => u.id) },
      isDeleted: false,
    },
    select: { id: true, parentId: true },
  });

  const assetToUnit = new Map<string, string>();
  for (const unit of units) {
    assetToUnit.set(unit.id, unit.id);
  }
  for (const child of childAssets) {
    if (child.parentId) assetToUnit.set(child.id, child.parentId);
  }

  const unitActivity = new Map<string, Map<string, number>>();
  for (const task of todayTasks) {
    const unitId = assetToUnit.get(task.assetId);
    if (!unitId) continue;
    const typeMap = unitActivity.get(unitId) ?? new Map<string, number>();
    typeMap.set(task.taskType, (typeMap.get(task.taskType) ?? 0) + 1);
    unitActivity.set(unitId, typeMap);
  }

  const summaryItems = [
    { label: "Toplam Görev", value: totalTasks, color: "#e8eaf0" },
    { label: "Tamamlanan", value: completedTasks, color: "#2ecc71" },
    { label: "Devam Eden", value: inProgressTasks, color: "#3498db" },
    { label: "Bekleyen", value: pendingTasks, color: "#f0a500" },
    { label: "Arıza", value: faultTasks, color: "#e74c3c" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            Günlük Rapor
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {format(now, "d MMMM yyyy, EEEE", { locale: tr })}
          </p>
        </div>
        <button
          type="button"
          id="toys-print-btn"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Printer className="size-4" />
          Yazdır
        </button>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html:
            'document.getElementById("toys-print-btn").addEventListener("click",function(){window.print()})',
        }}
      />

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide">
            Görev Özeti
          </h2>
          <div className="space-y-3">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between"
              >
                <span className="text-[12px] text-muted-foreground">
                  {item.label}
                </span>
                <span
                  className="font-mono text-lg font-semibold"
                  style={{ color: item.color }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide">
            Arıza Özeti
          </h2>
          <div className="space-y-3">
            {recentFaults.map((fault) => (
              <div
                key={fault.id}
                className="flex items-center justify-between rounded-md border border-border/50 bg-secondary/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[13px] font-medium">
                    {fault.asset.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {fault.description.length > 50
                      ? fault.description.slice(0, 50) + "…"
                      : fault.description}
                  </p>
                </div>
                <span className="shrink-0 pl-3 font-mono text-[11px] text-muted-foreground">
                  {format(fault.createdAt, "HH:mm")}
                </span>
              </div>
            ))}
            {recentFaults.length === 0 && (
              <p className="py-4 text-center font-mono text-xs text-muted-foreground">
                Arıza kaydı yok
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide">
            Personel Performansı
          </h2>
          <div className="space-y-3">
            {workers.map((worker) => {
              const count = statMap.get(worker.id) ?? 0;
              const pct = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
              return (
                <div key={worker.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[13px]">
                      {worker.fullName}
                    </span>
                    <span className="font-mono text-sm font-semibold text-[#2ecc71]">
                      {count}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-[#2ecc71]"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {workers.length === 0 && (
              <p className="py-4 text-center font-mono text-xs text-muted-foreground">
                Personel verisi yok
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide">
          Ünite Bazlı Faaliyet
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {units.map((unit) => {
            const typeMap = unitActivity.get(unit.id) ?? new Map();
            const unitTotal = Array.from(typeMap.values()).reduce(
              (a, b) => a + b,
              0
            );
            return (
              <div
                key={unit.id}
                className="rounded-md border border-border/50 bg-secondary/30 p-4"
              >
                <div className="mb-1 font-mono text-sm font-semibold">
                  {unit.name}
                </div>
                <div className="mb-3 font-mono text-[10px] text-muted-foreground">
                  Toplam {unitTotal} görev
                </div>
                <div className="space-y-2">
                  {TASK_TYPES.map((type) => (
                    <div
                      key={type}
                      className="flex items-center justify-between"
                    >
                      <span className="text-[11px] text-muted-foreground">
                        {TASK_TYPE_LABELS[type]}
                      </span>
                      <span className="font-mono text-sm font-medium">
                        {typeMap.get(type) ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {units.length === 0 && (
            <p className="col-span-3 py-6 text-center font-mono text-xs text-muted-foreground">
              Ünite verisi yok
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
