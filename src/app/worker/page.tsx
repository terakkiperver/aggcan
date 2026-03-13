"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, ClipboardList, ChevronRight, Bell } from "lucide-react";

interface WorkerInfo {
  id: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
}

interface LogEntry {
  id: string;
  type: "fault" | "hourly" | "checklist";
  title: string;
  detail: string | null;
  status: string;
  date: string;
}

interface WorkerTask {
  id: string;
  taskType: string;
  asset?: {
    name: string;
  };
}

const ACTION_BUTTONS = [
  {
    href: "/worker/fault",
    icon: Wrench,
    title: "Arıza Bildir",
    subtitle: "Makine seç · Fotoğraf · Açıklama",
    color: "var(--toys-red)",
    dimColor: "var(--toys-red-dim)",
    borderColor: "rgba(231,76,60,0.3)",
  },
  {
    href: "/worker/checklist",
    icon: ClipboardList,
    title: "Günlük Kontrol",
    subtitle: "Günlük kontrol · Makine durumu",
    color: "var(--toys-blue)",
    dimColor: "var(--toys-blue-dim)",
    borderColor: "rgba(52,152,219,0.3)",
  },
] as const;

const TYPE_COLORS: Record<string, string> = {
  fault: "var(--toys-red)",
  hourly: "var(--toys-orange)",
  checklist: "var(--toys-blue)",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function WorkerHomePage() {
  const [worker, setWorker] = useState<WorkerInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [currentTaskLabel, setCurrentTaskLabel] = useState("Atanmış görev yok");

  useEffect(() => {
    fetch("/api/worker/me")
      .then((r) => r.json())
      .then(setWorker)
      .catch(() => {});

    fetch("/api/worker/logs")
      .then((r) => r.json())
      .then((data) => setLogs(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {});

    fetch("/api/worker/tasks")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setTaskCount(0);
          setCurrentTaskLabel("Atanmış görev yok");
          return;
        }
        const tasks = data as WorkerTask[];
        setTaskCount(tasks.length);
        const firstTask = tasks[0];
        if (firstTask?.asset?.name) {
          setCurrentTaskLabel(`${firstTask.asset.name} · ${firstTask.taskType}`);
        } else if (firstTask?.taskType) {
          setCurrentTaskLabel(firstTask.taskType);
        } else {
          setCurrentTaskLabel("Atanmış görev yok");
        }
      })
      .catch(() => {
        setTaskCount(0);
        setCurrentTaskLabel("Atanmış görev yok");
      });
  }, []);

  return (
    <div className="space-y-5">
      {/* Worker identity */}
      {worker && (
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full font-semibold"
            style={{
              backgroundColor: "var(--toys-orange-dim)",
              color: "var(--toys-orange)",
            }}
          >
            {getInitials(worker.fullName)}
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">{worker.fullName}</div>
            <div className="text-xs text-muted-foreground">{currentTaskLabel}</div>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {/* Notification banner */}
        <Link
          href="/worker/hourly"
          className="flex items-center gap-4 rounded-2xl border border-amber-500/30 bg-card p-5 text-card-foreground ring-1 ring-foreground/10 transition-colors active:scale-[0.98]"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--toys-orange-dim)" }}
          >
            <Bell className="h-6 w-6" style={{ color: "var(--toys-orange)" }} />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold" style={{ color: "var(--toys-orange)" }}>
              Saatlik Bildirim
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">Durumunuzu bildirin</div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        {/* Action buttons */}
        <div className="space-y-3">
          {ACTION_BUTTONS.map((btn) => (
            <Link
              key={btn.href}
              href={btn.href}
              className="block rounded-2xl border bg-card p-5 text-card-foreground ring-1 ring-foreground/10 transition-colors active:scale-[0.98]"
              style={{
                borderColor: btn.borderColor,
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                  style={{
                    backgroundColor: btn.dimColor,
                    color: btn.color,
                  }}
                >
                  <btn.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold" style={{ color: btn.color }}>
                    {btn.title}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{btn.subtitle}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Tasks link */}
      <Link
        href="/worker/tasks"
        className="block rounded-xl border p-4 text-sm font-semibold transition-colors active:scale-[0.98]"
        style={{
          borderColor: "rgba(240,165,0,0.3)",
          backgroundColor: "var(--toys-orange)",
          color: "#000000",
        }}
      >
        <span className="flex items-center justify-center gap-2">
          Görevlerim
          <span className="rounded-full bg-white/85 px-2 py-0.5 text-xs font-bold text-black">
            {taskCount}
          </span>
          →
        </span>
      </Link>

      {/* Recent logs */}
      {logs.length > 0 && (
        <div>
          <h2 className="mb-3 font-mono text-xs font-semibold tracking-wider text-muted-foreground">
            SON BİLDİRİMLER
          </h2>
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[log.type] ?? "var(--muted-foreground)" }}
                  />
                  <span className="flex-1 truncate text-sm text-foreground">{log.title}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {new Date(log.date).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {log.detail && (
                  <div className="mt-1 truncate text-xs text-muted-foreground">{log.detail}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
