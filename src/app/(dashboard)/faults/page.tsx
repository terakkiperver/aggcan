"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, Loader2 } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FAULT_STATUS_LABELS,
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  type FaultStatus,
  type TaskType,
  type Priority,
} from "@/lib/types";
import { toast } from "sonner";

interface FaultItem {
  id: string;
  status: string;
  description: string;
  operationType: string | null;
  createdAt: string;
  asset: { id: string; name: string; code: string };
  reporter: { id: string; fullName: string };
  photos: Array<{ id: string; storagePath: string }>;
}

interface UserOption {
  id: string;
  fullName: string;
  role: string;
}

const statusColors: Record<string, string> = {
  open: "bg-red-500/20 text-red-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  resolved: "bg-green-500/20 text-green-400",
  closed: "bg-gray-500/20 text-gray-300",
};

const operationImpactLabels: Record<string, string> = {
  blocks_work: "Engeller",
  no_block: "Engellemez",
};

function getTodayLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function FaultsPage() {
  const [faults, setFaults] = useState<FaultItem[]>([]);
  const [assignees, setAssignees] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFault, setSelectedFault] = useState<FaultItem | null>(null);
  const [converting, setConverting] = useState(false);
  const [assignedToIds, setAssignedToIds] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<TaskType>("fault_repair");
  const [priority, setPriority] = useState<Priority>("normal");
  const [deadlineDate, setDeadlineDate] = useState(getTodayLocalDateString());
  const [taskDescription, setTaskDescription] = useState("");

  const fetchFaults = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const res = await fetch(`/api/faults?${params}`);
      if (!res.ok) {
        setFaults([]);
        return;
      }
      const data = await res.json();
      setFaults(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchFaults();
  }, [fetchFaults]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        const all = Array.isArray(data) ? (data as UserOption[]) : [];
        setAssignees(all.filter((u) => u.role === "worker" || u.role === "foreman"));
      })
      .catch(() => setAssignees([]));
  }, []);

  const openFaultModal = (fault: FaultItem) => {
    setSelectedFault(fault);
    setAssignedToIds([]);
    setTaskType("fault_repair");
    setPriority("normal");
    setDeadlineDate(getTodayLocalDateString());
    setTaskDescription(fault.description);
  };

  const handleConvertToTask = async () => {
    if (!selectedFault) return;
    if (assignedToIds.length === 0) {
      toast.error("Lütfen en az bir personel seçin.");
      return;
    }
    setConverting(true);
    try {
      const res = await fetch(`/api/faults/${selectedFault.id}/convert-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToIds,
          taskType,
          priority,
          deadlineAt: deadlineDate
            ? new Date(`${deadlineDate}T00:00:00`).toISOString()
            : undefined,
          description: taskDescription || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Arıza göreve çevrilemedi.");
        return;
      }
      toast.success("Arıza başarıyla göreve çevrildi.");
      setSelectedFault(null);
      await fetchFaults();
    } catch {
      toast.error("Arıza göreve çevrilemedi.");
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <AlertTriangle className="size-6" />
            Bildirilen Arızalar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personel tarafından bildirilen arızalar
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as string)}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="open">Açık</SelectItem>
            <SelectItem value="in_progress">İşleniyor</SelectItem>
            <SelectItem value="resolved">Çözüldü</SelectItem>
            <SelectItem value="closed">Kapalı</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : faults.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Arıza kaydı bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {faults.map((fault) => (
                <button
                  type="button"
                  key={fault.id}
                  onClick={() => openFaultModal(fault)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fault.asset.name}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono text-xs text-muted-foreground">{fault.asset.code}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{fault.description}</p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(fault.createdAt), "dd MMM yyyy HH:mm", { locale: tr })} ·{" "}
                      {fault.reporter.fullName}
                      {fault.operationType && (
                        <>
                          {" · "}
                          {operationImpactLabels[fault.operationType] || fault.operationType}
                        </>
                      )}
                      {fault.photos.length > 0 && <> · {fault.photos.length} foto</>}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={statusColors[fault.status] || "bg-muted text-muted-foreground"}
                  >
                    {FAULT_STATUS_LABELS[fault.status as FaultStatus] || fault.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedFault} onOpenChange={(open) => !open && setSelectedFault(null)}>
        <DialogContent className="sm:max-w-2xl">
          {selectedFault && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedFault.asset.name}</DialogTitle>
                <DialogDescription>
                  Bildirilen arıza detayı ve göreve çevirme
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Durum</p>
                  <p className="font-medium">
                    {FAULT_STATUS_LABELS[selectedFault.status as FaultStatus] || selectedFault.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bildirilen</p>
                  <p className="font-medium">
                    {format(new Date(selectedFault.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Açıklama</p>
                  <p className="font-medium">{selectedFault.description}</p>
                </div>
                {selectedFault.photos.length > 0 && (
                  <div className="col-span-2">
                    <p className="mb-1 text-xs text-muted-foreground">Fotoğraflar</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedFault.photos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.storagePath}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-md border border-border"
                        >
                          <img
                            src={photo.storagePath}
                            alt="Arıza fotoğrafı"
                            className="h-24 w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-md border border-border p-3">
                <p className="text-sm font-medium">Göreve Çevir</p>

                <div className="space-y-1.5">
                  <Label>Atanan Personeller</Label>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border bg-card p-2">
                    {assignees.map((u) => {
                      const checked = assignedToIds.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setAssignedToIds((prev) =>
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
                      <p className="text-xs text-muted-foreground">Atanabilir personel bulunamadı.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>İş Tipi</Label>
                    <Select value={taskType} onValueChange={(val) => setTaskType(val as TaskType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Öncelik</Label>
                    <Select value={priority} onValueChange={(val) => setPriority(val as Priority)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Termin</Label>
                    <input
                      type="date"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Görev Açıklaması</Label>
                  <Textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  onClick={handleConvertToTask}
                  disabled={converting || assignedToIds.length === 0}
                >
                  {converting && <Loader2 className="size-4 animate-spin" />}
                  Göreve Çevir
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
