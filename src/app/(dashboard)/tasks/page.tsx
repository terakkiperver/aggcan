"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskType,
  type Priority,
  type TaskStatus,
} from "@/lib/types";

interface TaskWithRelations {
  id: string;
  taskType: string;
  priority: string;
  status: string;
  description: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  createdAt: string;
  asset: {
    id: string;
    name: string;
    code: string;
    category: { id: string; name: string; code: string };
  };
  assignee: { id: string; fullName: string };
  taskAssignments?: Array<{
    user: { id: string; fullName: string };
  }>;
  creator?: { id: string; fullName: string };
}

interface UserOption {
  id: string;
  fullName: string;
  role: string;
}

const unitColors: Record<string, string> = {
  U1: "bg-orange-500/20 text-orange-400",
  U2: "bg-blue-500/20 text-blue-400",
  U3: "bg-green-500/20 text-green-400",
};

const statusColors: Record<string, string> = {
  pending: "bg-orange-500/20 text-orange-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  paused: "bg-amber-500/20 text-amber-400",
  completed: "bg-green-500/20 text-green-400",
  fault: "bg-red-500/20 text-red-400",
};

const priorityDotColors: Record<string, string> = {
  urgent: "bg-red-500",
  normal: "bg-amber-500",
  low: "bg-gray-500",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [assignees, setAssignees] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(
    null
  );
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingAssigneeIds, setEditingAssigneeIds] = useState<string[]>([]);
  const [editingDescription, setEditingDescription] = useState("");
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (unitFilter !== "all") params.set("unit", unitFilter);
      const res = await fetch(`/api/tasks?${params}`);
      if (res.ok) {
        setTasks(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, unitFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        const allUsers = Array.isArray(data) ? (data as UserOption[]) : [];
        setAssignees(
          allUsers.filter((u) => u.role === "worker" || u.role === "foreman")
        );
      })
      .catch(() => setAssignees([]));
  }, []);

  useEffect(() => {
    if (!selectedTask) {
      setEditingAssigneeIds([]);
      setEditingDescription("");
      setAssigneeDropdownOpen(false);
      return;
    }
    const ids =
      selectedTask.taskAssignments && selectedTask.taskAssignments.length > 0
        ? selectedTask.taskAssignments.map((a) => a.user.id)
        : [selectedTask.assignee.id];
    setEditingAssigneeIds(ids);
    setEditingDescription(selectedTask.description ?? "");
    setAssigneeDropdownOpen(false);
  }, [selectedTask]);

  const updateStatus = async (taskId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        setSelectedTask(updated);
      }
    } finally {
      setUpdating(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Görev silinemedi.");
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedTask(null);
      setConfirmingDelete(false);
      toast.success("Görev silindi.");
    } catch {
      toast.error("Görev silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  const updateTaskStatusFromList = async (
    taskId: string,
    nextStatus: "in_progress" | "paused"
  ) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          data?.error ||
            (nextStatus === "paused"
              ? "Görev duraklatılamadı."
              : "Görev başlatılamadı.")
        );
        return;
      }
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      if (selectedTask?.id === taskId) {
        setSelectedTask(updated);
      }
      toast.success(nextStatus === "paused" ? "Görev duraklatıldı." : "Görev başlatıldı.");
    } catch {
      toast.error(
        nextStatus === "paused" ? "Görev duraklatılamadı." : "Görev başlatılamadı."
      );
    } finally {
      setUpdating(false);
    }
  };

  const saveTaskDetails = async () => {
    if (!selectedTask) return;
    if (editingAssigneeIds.length === 0) {
      toast.error("En az bir personel seçin.");
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToIds: editingAssigneeIds,
          description: editingDescription,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Görev güncellenemedi.");
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === selectedTask.id ? (data as TaskWithRelations) : t))
      );
      setSelectedTask(data as TaskWithRelations);
      toast.success("Görev bilgileri güncellendi.");
    } catch {
      toast.error("Görev güncellenemedi.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ListChecks className="size-6" />
            Görev Listesi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tüm görevler — filtrele ve takip et
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as string)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="pending">Bekliyor</SelectItem>
              <SelectItem value="in_progress">Devam Ediyor</SelectItem>
              <SelectItem value="paused">Duraklatıldı</SelectItem>
              <SelectItem value="completed">Tamamlandı</SelectItem>
              <SelectItem value="fault">Arıza</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={unitFilter}
            onValueChange={(val) => setUnitFilter(val as string)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Üniteler</SelectItem>
              <SelectItem value="U1">U1</SelectItem>
              <SelectItem value="U2">U2</SelectItem>
              <SelectItem value="U3">U3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Görev bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tasks.map((task, index) => {
                const unitCode = task.asset.category.code;
                const assigneeNames =
                  task.taskAssignments && task.taskAssignments.length > 0
                    ? task.taskAssignments.map((a) => a.user.fullName)
                    : [task.assignee.fullName];
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className={`size-2 rounded-full shrink-0 ${
                        priorityDotColors[task.priority] || "bg-gray-500"
                      }`}
                    />
                    <span className="text-xs text-muted-foreground font-mono w-8">
                      #{index + 1}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        unitColors[unitCode] ||
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {unitCode}
                    </span>
                    <span className="flex-1 truncate text-sm">
                      {task.asset.name}
                      <span className="text-muted-foreground">
                        {" · "}
                        {TASK_TYPE_LABELS[task.taskType as TaskType] ||
                          task.taskType}
                        {" · "}
                        {format(new Date(task.createdAt), "HH:mm", {
                          locale: tr,
                        })}
                      </span>
                    </span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {assigneeNames.join(", ")}
                    </Badge>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        statusColors[task.status] ||
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {TASK_STATUS_LABELS[task.status as TaskStatus] ||
                        task.status}
                    </span>
                    {task.status === "pending" && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void updateTaskStatusFromList(task.id, "in_progress");
                        }}
                        disabled={updating}
                      >
                        Başla
                      </Button>
                    )}
                    {task.status === "in_progress" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          void updateTaskStatusFromList(task.id, "paused");
                        }}
                        disabled={updating}
                      >
                        Duraklat
                      </Button>
                    )}
                    {task.status === "paused" && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void updateTaskStatusFromList(task.id, "in_progress");
                        }}
                        disabled={updating}
                      >
                        Devam Et
                      </Button>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null);
            setConfirmingDelete(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTask.asset.name}</DialogTitle>
                <DialogDescription>
                  {TASK_TYPE_LABELS[selectedTask.taskType as TaskType] ||
                    selectedTask.taskType}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="relative col-span-2">
                  <p className="text-muted-foreground text-xs">Atanan Personeller</p>
                  <button
                    type="button"
                    onClick={() => setAssigneeDropdownOpen((prev) => !prev)}
                    className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-left text-sm hover:bg-muted/40"
                  >
                    {editingAssigneeIds.length > 0
                      ? assignees
                          .filter((u) => editingAssigneeIds.includes(u.id))
                          .map((u) => u.fullName)
                          .join(", ")
                      : "Personel seçiniz"}
                  </button>
                  {assigneeDropdownOpen && (
                    <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-card p-2 shadow-lg">
                      {assignees.map((u) => {
                        const checked = editingAssigneeIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setEditingAssigneeIds((prev) =>
                                  e.target.checked
                                    ? prev.includes(u.id)
                                      ? prev
                                      : [...prev, u.id]
                                    : prev.filter((id) => id !== u.id)
                                );
                              }}
                              className="h-4 w-4 accent-[var(--toys-blue)]"
                            />
                            <span>
                              {u.fullName} ({u.role === "foreman" ? "Ustabaşı" : "Personel"})
                            </span>
                          </label>
                        );
                      })}
                      {assignees.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Atanabilir personel bulunamadı.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ünite</p>
                  <p className="font-medium">
                    {selectedTask.asset.category.name}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">İş Tipi</p>
                  <p className="font-medium">
                    {TASK_TYPE_LABELS[selectedTask.taskType as TaskType] ||
                      selectedTask.taskType}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Öncelik</p>
                  <p className="font-medium">
                    {PRIORITY_LABELS[selectedTask.priority as Priority] ||
                      selectedTask.priority}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Durum</p>
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                      statusColors[selectedTask.status] || "bg-muted"
                    }`}
                  >
                    {TASK_STATUS_LABELS[selectedTask.status as TaskStatus] ||
                      selectedTask.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Oluşturulma</p>
                  <p className="font-medium">
                    {format(
                      new Date(selectedTask.createdAt),
                      "dd MMM yyyy HH:mm",
                      { locale: tr }
                    )}
                  </p>
                </div>
                {selectedTask.startedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs">Başlangıç</p>
                    <p className="font-medium">
                      {format(
                        new Date(selectedTask.startedAt),
                        "dd MMM yyyy HH:mm",
                        { locale: tr }
                      )}
                    </p>
                  </div>
                )}
                {selectedTask.completedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs">Bitiş</p>
                    <p className="font-medium">
                      {format(
                        new Date(selectedTask.completedAt),
                        "dd MMM yyyy HH:mm",
                        { locale: tr }
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-sm">
                <Label>Açıklama</Label>
                <Textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {confirmingDelete && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
                  <p className="font-medium text-red-400">Emin misiniz?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bu görev kalıcı olarak silinecek.
                  </p>
                </div>
              )}

              <DialogFooter>
                {!confirmingDelete ? (
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={deleting || updating}
                  >
                    Görevi Sil
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                    >
                      Vazgeç
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void deleteTask(selectedTask.id)}
                      disabled={deleting}
                    >
                      {deleting && <Loader2 className="size-4 animate-spin" />}
                      Evet, Sil
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void saveTaskDetails()}
                  disabled={updating || deleting}
                >
                  {updating && <Loader2 className="size-4 animate-spin" />}
                  Değişiklikleri Kaydet
                </Button>
                {selectedTask.status === "pending" && (
                  <Button
                    onClick={() =>
                      updateStatus(selectedTask.id, "in_progress")
                    }
                    disabled={updating || deleting || confirmingDelete}
                  >
                    {updating && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Başla
                  </Button>
                )}
                {selectedTask.status === "in_progress" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateStatus(selectedTask.id, "paused")
                      }
                      disabled={updating || deleting || confirmingDelete}
                    >
                      Duraklat
                    </Button>
                    <Button
                      onClick={() =>
                        updateStatus(selectedTask.id, "completed")
                      }
                      disabled={updating || deleting || confirmingDelete}
                    >
                      {updating && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      Tamamlandı
                    </Button>
                  </>
                )}
                {selectedTask.status === "paused" && (
                  <Button
                    type="button"
                    onClick={() =>
                      updateStatus(selectedTask.id, "in_progress")
                    }
                    disabled={updating || deleting || confirmingDelete}
                  >
                    Devam Et
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
