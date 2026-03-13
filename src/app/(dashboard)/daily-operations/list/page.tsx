"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";

const statusColors: Record<string, string> = {
  pending: "bg-orange-500/20 text-orange-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  paused: "bg-amber-500/20 text-amber-400",
  completed: "bg-green-500/20 text-green-400",
  fault: "bg-red-500/20 text-red-400",
};

interface DailyOperationRow {
  id: string;
  status: string;
  description: string | null;
  createdAt: string;
  deadlineAt: string;
  asset: {
    name: string;
    category: {
      code: string;
    };
  };
  assignments: Array<{
    user: {
      fullName: string;
    };
  }>;
}

function getTodayLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(dateString: string, days: number) {
  const base = new Date(`${dateString}T00:00:00`);
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DailyOperationsListPage() {
  const [operations, setOperations] = useState<DailyOperationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());

  const fetchOperations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-operations?date=${selectedDate}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Liste alınamadı.");
        setOperations([]);
        return;
      }
      setOperations(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Liste alınamadı.");
      setOperations([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void fetchOperations();
  }, [fetchOperations]);

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Emin misiniz? Bu günlük operasyon kaydı silinecek."
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/daily-operations/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Silme işlemi başarısız.");
        return;
      }
      setOperations((prev) => prev.filter((row) => row.id !== id));
      toast.success("Günlük operasyon kaydı silindi.");
    } catch {
      toast.error("Silme işlemi başarısız.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusUpdate = async (
    id: string,
    nextStatus: "in_progress" | "paused"
  ) => {
    setStatusUpdatingId(id);
    try {
      const res = await fetch(`/api/daily-operations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          data?.error ||
            (nextStatus === "paused"
              ? "Duraklatma işlemi başarısız."
              : "Başlatma işlemi başarısız.")
        );
        return;
      }
      setOperations((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, status: nextStatus } : row
        )
      );
      toast.success(
        nextStatus === "paused"
          ? "Günlük operasyon duraklatıldı."
          : "Günlük operasyon başlatıldı."
      );
    } catch {
      toast.error(
        nextStatus === "paused"
          ? "Duraklatma işlemi başarısız."
          : "Başlatma işlemi başarısız."
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Günlük Operasyon Listesi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ünite bazlı günlük operasyon görevlerinin listesi
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/60"
          >
            Geri
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(getTodayLocalDateString())}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/60"
          >
            Bugün
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/60"
          >
            İleri
          </button>
          <span className="ml-1 rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-foreground">
            {format(new Date(`${selectedDate}T00:00:00`), "dd MMM yyyy", { locale: tr })}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Yükleniyor...
          </div>
        ) : operations.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Günlük operasyon kaydı bulunamadı.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {operations.map((operation) => {
              const names =
                operation.assignments.length > 0
                  ? operation.assignments.map((a) => a.user.fullName).join(", ")
                  : "-";
              return (
                <div key={operation.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{operation.asset.category.code}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="truncate">{operation.asset.name}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {format(operation.createdAt, "dd MMM yyyy HH:mm", { locale: tr })} · {names}
                    </div>
                    {operation.description && (
                      <div className="mt-1 text-xs text-muted-foreground">{operation.description}</div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      statusColors[operation.status] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {TASK_STATUS_LABELS[operation.status as TaskStatus] || operation.status}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {operation.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(operation.id, "in_progress")}
                        disabled={statusUpdatingId === operation.id || deletingId === operation.id}
                        className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-60"
                      >
                        {statusUpdatingId === operation.id ? "Başlatılıyor..." : "Başla"}
                      </button>
                    )}
                    {operation.status === "in_progress" && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(operation.id, "paused")}
                        disabled={statusUpdatingId === operation.id || deletingId === operation.id}
                        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
                      >
                        {statusUpdatingId === operation.id ? "Duraklatılıyor..." : "Duraklat"}
                      </button>
                    )}
                    {operation.status === "paused" && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(operation.id, "in_progress")}
                        disabled={statusUpdatingId === operation.id || deletingId === operation.id}
                        className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-60"
                      >
                        {statusUpdatingId === operation.id ? "Başlatılıyor..." : "Devam Et"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(operation.id)}
                      disabled={deletingId === operation.id || statusUpdatingId === operation.id}
                      className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-60"
                    >
                      {deletingId === operation.id ? "Siliniyor..." : "Sil"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
