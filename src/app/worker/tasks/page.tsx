"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Play, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface TaskItem {
  id: string;
  kind?: "task" | "daily_operation";
  taskType: string;
  priority: string;
  status: string;
  description: string | null;
  createdAt: string;
  asset: { name: string; code: string };
  creator: { fullName: string };
}

const PRIORITY_STYLES: Record<string, { color: string; dim: string; label: string }> = {
  urgent: { color: "var(--toys-red)", dim: "var(--toys-red-dim)", label: "Acil" },
  high: { color: "var(--toys-orange)", dim: "var(--toys-orange-dim)", label: "Yüksek" },
  normal: { color: "var(--toys-blue)", dim: "var(--toys-blue-dim)", label: "Normal" },
  low: { color: "var(--muted-foreground)", dim: "var(--muted)", label: "Düşük" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  in_progress: "Devam Ediyor",
  paused: "Duraklatıldı",
  completed: "Tamamlandı",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [pendingCompleteTaskId, setPendingCompleteTaskId] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/worker/tasks");
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }

  function getUpdateEndpoint(task: TaskItem) {
    return task.kind === "daily_operation"
      ? `/api/daily-operations/${task.id}`
      : `/api/tasks/${task.id}`;
  }

  async function updateTask(task: TaskItem, newStatus: string) {
    const id = task.id;
    setUpdating(id);
    try {
      const body: Record<string, unknown> = { status: newStatus };
      if (newStatus === "in_progress") body.startedAt = new Date().toISOString();
      if (newStatus === "completed") body.completedAt = new Date().toISOString();

      const res = await fetch(getUpdateEndpoint(task), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error();
      toast.success(
        newStatus === "completed"
          ? "Görev tamamlandı!"
          : newStatus === "paused"
            ? "Görev duraklatıldı!"
            : "Görev başlatıldı!"
      );
      fetchTasks();
    } catch {
      toast.error("Bir hata oluştu.");
    } finally {
      setUpdating(null);
    }
  }

  async function completeTaskWithPhoto(taskId: string, photo: File) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setUpdating(taskId);
    try {
      const formData = new FormData();
      formData.append("status", "completed");
      formData.append("photo", photo);

      const res = await fetch(getUpdateEndpoint(task), {
        method: "PATCH",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Görev tamamlanamadı.");
        return;
      }
      toast.success("Görev tamamlandı!");
      setPendingCompleteTaskId(null);
      fetchTasks();
    } catch {
      toast.error("Bir hata oluştu.");
    } finally {
      setUpdating(null);
    }
  }

  const openCameraForCompletion = (taskId: string) => {
    setPendingCompleteTaskId(taskId);
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 0);
  };

  return (
    <div className="space-y-5">
      <Link
        href="/worker"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground active:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Geri
      </Link>

      <h1 className="text-xl font-bold text-foreground">Görevlerim</h1>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Atanmış görev yok
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const ps = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.normal;
            const isUpdating = updating === task.id;

            return (
              <div
                key={task.id}
                className="rounded-xl border bg-card p-4"
                style={{ borderColor: ps.color + "40" }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {task.asset.name}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {task.taskType} · {task.creator.fullName}
                    </div>
                  </div>
                  <span
                    className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: ps.dim, color: ps.color }}
                  >
                    {ps.label}
                  </span>
                </div>

                {task.description && (
                  <div className="mt-2 text-xs text-muted-foreground">{task.description}</div>
                )}

                <div className="mt-2 text-[10px] text-muted-foreground">
                  {STATUS_LABELS[task.status] ?? task.status}
                </div>

                <div className="mt-3 flex gap-2">
                  {task.status === "pending" && (
                    <button
                      onClick={() => updateTask(task, "in_progress")}
                      disabled={isUpdating}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ backgroundColor: "var(--toys-blue)" }}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Başla
                    </button>
                  )}

                  {task.status === "in_progress" && (
                    <>
                      <button
                        onClick={() => openCameraForCompletion(task.id)}
                        disabled={isUpdating}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "var(--toys-green)" }}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Tamamladım
                      </button>
                      <button
                        onClick={() => updateTask(task, "paused")}
                        disabled={isUpdating}
                        className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: "var(--toys-orange-dim)",
                          color: "var(--toys-orange)",
                        }}
                      >
                        Duraklat
                      </button>
                    </>
                  )}

                  {task.status === "paused" && (
                    <button
                      onClick={() => updateTask(task, "in_progress")}
                      disabled={isUpdating}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ backgroundColor: "var(--toys-blue)" }}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Devam Et
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (!file || !pendingCompleteTaskId) {
            setPendingCompleteTaskId(null);
            e.currentTarget.value = "";
            return;
          }
          void completeTaskWithPhoto(pendingCompleteTaskId, file);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
