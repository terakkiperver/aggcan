"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UserOption {
  id: string;
  fullName: string;
  role: string;
}

interface AssetOption {
  id: string;
  name: string;
  category: {
    code: string;
  };
}

const UNITS = ["U1", "U2", "U3"];
const ASSET_CATEGORY_OPTIONS = [
  { code: "TV", label: "Taşıt" },
  { code: "IM", label: "İş Makinası" },
];

function getTodayLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DailyOperationSection() {
  const deadlineInputRef = useRef<HTMLInputElement | null>(null);
  const [targetType, setTargetType] = useState<"unit" | "asset">("unit");
  const [unit, setUnit] = useState("U1");
  const [assetCategoryCode, setAssetCategoryCode] = useState<"TV" | "IM">("TV");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [assetId, setAssetId] = useState("");
  const [assignees, setAssignees] = useState<UserOption[]>([]);
  const [assignedToIds, setAssignedToIds] = useState<string[]>([]);
  const [deadlineDate, setDeadlineDate] = useState(getTodayLocalDateString());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    fetch(`/api/assets?categoryCode=${assetCategoryCode}`)
      .then((r) => r.json())
      .then((data) => setAssets(Array.isArray(data) ? (data as AssetOption[]) : []))
      .catch(() => setAssets([]));
  }, [assetCategoryCode]);

  const selectedAssigneeLabel = assignedToIds.length
    ? `${assignedToIds.length} personel seçildi`
    : "Seçiniz";
  const selectedTargetTypeLabel =
    targetType === "unit" ? "Ünite (U1/U2/U3)" : "Asset (Taşıt/İş Makinası)";
  const selectedAssetCategoryLabel =
    ASSET_CATEGORY_OPTIONS.find((c) => c.code === assetCategoryCode)?.label ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (assignedToIds.length === 0) {
      toast.error("Personel seçimi zorunludur.");
      return;
    }

    if (targetType === "unit" && !unit) {
      toast.error("Ünite seçimi zorunludur.");
      return;
    }

    if (targetType === "asset" && !assetId) {
      toast.error("Asset seçimi zorunludur.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks/daily-operation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit,
          assetId: targetType === "asset" ? assetId : undefined,
          assignedToIds,
          deadlineDate,
          note: note || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Günlük operasyon görevi oluşturulamadı.");
        return;
      }

      toast.success("Günlük operasyon görevi oluşturuldu.");
      setAssignedToIds([]);
      setDeadlineDate(getTodayLocalDateString());
      setNote("");
      if (targetType === "asset") {
        setAssetId("");
      }
    } catch {
      toast.error("Günlük operasyon görevi oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
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
    <Card>
      <CardHeader>
        <CardTitle>Günlük Operasyon</CardTitle>
        <CardDescription>
          Ünite bazlı genel operasyon görevi oluştur ve personel ata
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hedef Tipi</Label>
              <Select
                value={targetType}
                onValueChange={(val) => {
                  if (!val) return;
                  setTargetType(val as "unit" | "asset");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedTargetTypeLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unit">Ünite (U1/U2/U3)</SelectItem>
                  <SelectItem value="asset">Asset (Taşıt/İş Makinası)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Atanan Personeller</Label>
              <div className="rounded-md border border-border bg-card p-2">
                <div className="mb-2 text-xs text-muted-foreground">
                  {selectedAssigneeLabel}
                </div>
                <div className="max-h-32 space-y-1 overflow-y-auto">
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
          </div>

          {targetType === "unit" ? (
            <div className="space-y-1.5">
              <Label>Ünite</Label>
              <Select value={unit} onValueChange={(val) => setUnit(val as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Asset Kategorisi</Label>
                <Select
                  value={assetCategoryCode}
                  onValueChange={(val) => {
                    if (!val) return;
                    setAssetCategoryCode(val as "TV" | "IM");
                    setAssetId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{selectedAssetCategoryLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Asset</Label>
                <Select value={assetId} onValueChange={(val) => setAssetId(val as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        assets.length === 0 ? "Asset bulunamadı" : "Asset seçiniz"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

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

          <div className="space-y-1.5">
            <Label>Not (Opsiyonel)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                targetType === "unit"
                  ? `${unit} günlük operasyon notu...`
                  : `${assetCategoryCode} günlük operasyon notu...`
              }
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Oluşturuluyor..." : "Günlük Operasyon Görevi Oluştur"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
