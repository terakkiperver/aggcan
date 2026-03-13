"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { HardDrive, Loader2, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_TYPE_LABELS,
  FAULT_STATUS_LABELS,
  type TaskType,
  type FaultStatus,
  type AssetStatus,
} from "@/lib/types";

interface AssetRow {
  id: string;
  name: string;
  code: string;
  status: string;
  metadata: string;
  category: { id: string; name: string; code: string };
}

interface TaskRow {
  id: string;
  assetId: string;
  taskType: string;
  status: string;
  description: string | null;
  createdAt: string;
  completedAt: string | null;
  assignee: { id: string; fullName: string };
}

interface FaultRow {
  id: string;
  assetId: string;
  description: string;
  status: string;
  createdAt: string;
  reporter: { id: string; fullName: string };
}

type TimelineEntry = {
  id: string;
  date: Date;
  kind: "task" | "fault";
  color: string;
  label: string;
  workerName: string;
  description: string;
};

const unitColors: Record<string, string> = {
  U1: "bg-orange-500/20 text-orange-400",
  U2: "bg-blue-500/20 text-blue-400",
  U3: "bg-green-500/20 text-green-400",
};

const statusBadge: Record<string, { label: string; className: string }> = {
  active: { label: "Aktif", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  maintenance: { label: "Bakımda", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  fault: { label: "Arızalı", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  inactive: { label: "Pasif", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

const timelineColors: Record<string, string> = {
  operation: "#3498db",
  fault_repair: "#e74c3c",
  maintenance: "#f0a500",
  cleaning: "#2ecc71",
  stock_check: "#9b59b6",
  fault: "#e74c3c",
};

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [faults, setFaults] = useState<FaultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitFilter, setUnitFilter] = useState("all");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRes, tasksRes, faultsRes] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/tasks"),
        fetch("/api/faults"),
      ]);
      if (assetsRes.ok) setAssets(await assetsRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (faultsRes.ok) setFaults(await faultsRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAssets =
    unitFilter === "all"
      ? assets
      : assets.filter((a) => a.category.code === unitFilter);

  const timeline: TimelineEntry[] = [];

  if (selectedAssetId) {
    for (const t of tasks.filter((t) => t.assetId === selectedAssetId)) {
      timeline.push({
        id: t.id,
        date: new Date(t.createdAt),
        kind: "task",
        color: timelineColors[t.taskType] || "#888",
        label: TASK_TYPE_LABELS[t.taskType as TaskType] || t.taskType,
        workerName: t.assignee.fullName,
        description: t.description || "—",
      });
    }
    for (const f of faults.filter((f) => f.assetId === selectedAssetId)) {
      timeline.push({
        id: f.id,
        date: new Date(f.createdAt),
        kind: "fault",
        color: timelineColors.fault,
        label: `Arıza — ${FAULT_STATUS_LABELS[f.status as FaultStatus] || f.status}`,
        workerName: f.reporter.fullName,
        description:
          f.description.length > 80 ? f.description.slice(0, 80) + "…" : f.description,
      });
    }
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <HardDrive className="size-6" />
          Makine Geçmişi
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arıza, bakım ve işlem kayıtları
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Left: Machine List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Makine Listesi</CardTitle>
              <Select value={unitFilter} onValueChange={(val) => setUnitFilter(val ?? "all")}>
                <SelectTrigger className="w-36" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Üniteler</SelectItem>
                  <SelectItem value="U1">U1</SelectItem>
                  <SelectItem value="U2">U2</SelectItem>
                  <SelectItem value="U3">U3</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ünite</TableHead>
                    <TableHead>Makine</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => {
                    const meta = parseMetadata(asset.metadata);
                    const st = statusBadge[asset.status as AssetStatus] || statusBadge.inactive;
                    const isSelected = asset.id === selectedAssetId;
                    return (
                      <TableRow
                        key={asset.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-muted" : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedAssetId(asset.id)}
                      >
                        <TableCell>
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              unitColors[asset.category.code] || "bg-muted text-muted-foreground"
                            }`}
                          >
                            {asset.category.code}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{asset.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(meta.type as string) || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={st.className}>
                            {st.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredAssets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        Makine bulunamadı.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Right: Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <History className="size-4" />
                İşlem Geçmişi
                {selectedAsset && (
                  <span className="text-muted-foreground font-normal">
                    — {selectedAsset.name}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedAssetId ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <HardDrive className="mb-2 size-8 opacity-40" />
                  <p className="text-sm">Makine seçin</p>
                </div>
              ) : timeline.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Bu makine için kayıt bulunamadı.
                </div>
              ) : (
                <div className="space-y-0">
                  {timeline.map((entry, i) => (
                    <div key={entry.id} className="relative flex gap-3 pb-4">
                      {i < timeline.length - 1 && (
                        <div className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-border" />
                      )}
                      <div className="relative mt-1.5 shrink-0">
                        <div
                          className="size-[15px] rounded-full border-2 border-card"
                          style={{ backgroundColor: entry.color }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {format(entry.date, "dd MMM HH:mm", { locale: tr })}
                          </span>
                          <span
                            className="inline-flex rounded-full px-1.5 py-0.5 font-mono text-[9px] font-medium"
                            style={{
                              backgroundColor: entry.color + "20",
                              color: entry.color,
                            }}
                          >
                            {entry.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] font-medium">{entry.workerName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {entry.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
