"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle, Loader2, CalendarDays } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  type TaskType,
  type Priority,
} from "@/lib/types";

interface AssetOption {
  id: string;
  name: string;
  code: string;
  category: { id: string; name: string; code: string };
}

interface UserOption {
  id: string;
  fullName: string;
  role: string;
}

const UNIT_OPTIONS = [
  { code: "U1", label: "Ünite 1" },
  { code: "U2", label: "Ünite 2" },
  { code: "U3", label: "Ünite 3" },
  { code: "TS", label: "Taşıt" },
  { code: "IM", label: "İş Makinesi" },
];

function getTodayLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewTaskPage() {
  const router = useRouter();
  const deadlineInputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [assignees, setAssignees] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [unit, setUnit] = useState("");
  const [assetId, setAssetId] = useState("");
  const [assignedToIds, setAssignedToIds] = useState<string[]>([]);
  const [taskType, setTaskType] = useState("");
  const [priority, setPriority] = useState("normal");
  const [deadlineDate, setDeadlineDate] = useState(getTodayLocalDateString());
  const [description, setDescription] = useState("");

  const selectedAssetLabel =
    assets.find((a) => a.id === assetId)?.name ?? "";
  const selectedAssigneeLabel = assignedToIds.length
    ? `${assignedToIds.length} personel seçildi`
    : "";
  const selectedTaskTypeLabel =
    (taskType && TASK_TYPE_LABELS[taskType as TaskType]) || "";
  const selectedPriorityLabel =
    (priority && PRIORITY_LABELS[priority as Priority]) || "";

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((data) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => setAssets([]));
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

  const categoryCodeAliases: Record<string, string[]> = {
    TS: ["TS", "TV"],
    TV: ["TS", "TV"],
    IM: ["IM"],
    U1: ["U1"],
    U2: ["U2"],
    U3: ["U3"],
  };

  const filteredAssets = unit
    ? assets.filter((a) =>
        (categoryCodeAliases[unit] ?? [unit]).includes(a.category.code)
      )
    : assets;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId || assignedToIds.length === 0 || !taskType) {
      toast.error("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          assignedToIds,
          taskType,
          priority,
          deadlineAt: deadlineDate
            ? new Date(`${deadlineDate}T00:00:00`).toISOString()
            : undefined,
          description: description || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Görev başarıyla oluşturuldu.");
        router.push("/tasks");
      } else {
        const data = await res.json();
        toast.error(data.error || "Bir hata oluştu.");
      }
    } catch {
      toast.error("Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setUnit("");
    setAssetId("");
    setAssignedToIds([]);
    setTaskType("");
    setPriority("normal");
    setDeadlineDate(getTodayLocalDateString());
    setDescription("");
  };

  const openDeadlinePicker = () => {
    const input = deadlineInputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <PlusCircle className="size-6" />
          Yeni Görev Oluştur
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ofis tarafından görev ataması
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Görev Bilgileri</CardTitle>
          <CardDescription>Görev detaylarını girin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ünite/Taşıt</Label>
                <Select
                  value={unit}
                  onValueChange={(val) => {
                    setUnit(val as string);
                    setAssetId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.code} value={u.code}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Makine</Label>
                <Select
                  value={assetId}
                  onValueChange={(val) => {
                    setAssetId(val as string);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seçiniz">
                      {selectedAssetLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAssets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Atanan Personeller</Label>
                <div className="rounded-md border border-border bg-card p-2">
                  <div className="mb-2 text-xs text-muted-foreground">
                    {selectedAssigneeLabel || "Seçiniz"}
                  </div>
                  <div className="max-h-36 space-y-1 overflow-y-auto">
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
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>İş Tipi</Label>
                  <Select
                    value={taskType}
                    onValueChange={(val) => setTaskType(val as string)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seçiniz">
                        {selectedTaskTypeLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]
                      ).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Öncelik</Label>
                  <Select
                    value={priority}
                    onValueChange={(val) => setPriority(val as string)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{selectedPriorityLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(PRIORITY_LABELS) as [Priority, string][]
                      ).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Açıklama</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Görev açıklaması..."
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Termin Tarihi</Label>
              <div className="relative">
                <input
                  ref={deadlineInputRef}
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  onClick={openDeadlinePicker}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm text-foreground outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <button
                  type="button"
                  onClick={openDeadlinePicker}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Tarih seç"
                >
                  <CalendarDays className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Görevi Oluştur
              </Button>
              <Button type="button" variant="ghost" onClick={handleClear}>
                Temizle
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
