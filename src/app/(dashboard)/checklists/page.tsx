"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ClipboardCheck,
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHECKLIST_TYPE_LABELS, type ChecklistItemType } from "@/lib/types";

interface TemplateItem {
  id: string;
  label: string;
  itemType: string;
  options: string | null;
  unit: string | null;
  displayOrder: number;
}

interface Template {
  id: string;
  name: string;
  isActive: boolean;
  items: TemplateItem[];
  category: { id: string; name: string; code: string } | null;
  templateAssets: Array<{
    id: string;
    asset: { id: string; name: string; code: string };
  }>;
}

interface AssetOption {
  id: string;
  name: string;
  code: string;
}

const typeBadgeColors: Record<string, string> = {
  tick: "bg-green-500/20 text-green-400 border-green-500/30",
  two_option: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  three_option: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  numeric: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export default function ChecklistsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    name: "",
    items: [{ label: "", itemType: "tick" }] as { label: string; itemType: string }[],
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checklists/templates");
      if (res.ok) setTemplates(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((data) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => setAssets([]));
  }, []);


  const dailyTemplate = templates.length > 0 ? templates[0] : null;
  const dailyItems = dailyTemplate?.items || [];

  const handleSaveChecks = () => {
    const checked = dailyItems.filter((item) => checkedItems[item.id]);
    if (checked.length === 0) {
      toast.error("Lütfen en az bir kontrol işaretleyin.");
      return;
    }
    toast.success(`${checked.length} kontrol kaydedildi.`);
    setCheckedItems({});
  };

  const handleCreateTemplate = async () => {
    if (!form.name) {
      toast.error("Şablon adı gereklidir.");
      return;
    }
    const validItems = form.items.filter((i) => i.label.trim());
    if (validItems.length === 0) {
      toast.error("En az bir madde ekleyin.");
      return;
    }
    if (selectedAssetIds.length === 0) {
      toast.error("En az bir makine seçin.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/checklists/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          assetIds: selectedAssetIds,
          items: validItems,
        }),
      });
      if (res.ok) {
        toast.success("Şablon oluşturuldu.");
        setCreateOpen(false);
        setForm({ name: "", items: [{ label: "", itemType: "tick" }] });
        setSelectedAssetIds([]);
        fetchTemplates();
      } else {
        const data = await res.json();
        toast.error(data.error || "Bir hata oluştu.");
      }
    } finally {
      setSaving(false);
    }
  };

  const addFormItem = () => {
    setForm((f) => ({
      ...f,
      items: [...f.items, { label: "", itemType: "tick" }],
    }));
  };

  const updateFormItem = (idx: number, field: string, value: string) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  };

  const removeFormItem = (idx: number) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardCheck className="size-6" />
            Kontrol Listesi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Periyodik bakım ve rutin kontroller
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Yeni Şablon
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Daily Checks */}
            <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Günlük Kontroller</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Günlük kontrol şablonu bulunamadı.
                </p>
              ) : (
                <div className="space-y-3">
                  {dailyItems.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 rounded-md border border-border/50 bg-secondary/30 p-3 transition-colors hover:bg-secondary/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={!!checkedItems[item.id]}
                        onCheckedChange={(checked) =>
                          setCheckedItems((prev) => ({
                            ...prev,
                            [item.id]: !!checked,
                          }))
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={typeBadgeColors[item.itemType] || ""}
                          >
                            {CHECKLIST_TYPE_LABELS[item.itemType as ChecklistItemType] ||
                              item.itemType}
                          </Badge>
                          {item.unit && (
                            <span className="text-[10px] text-muted-foreground">
                              Birim: {item.unit}
                            </span>
                          )}
                          {item.options && (
                            <span className="text-[10px] text-muted-foreground">
                              Seçenekler: {item.options}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                  <Button
                    className="w-full mt-2"
                    onClick={handleSaveChecks}
                    variant="default"
                  >
                    Kontrolleri Kaydet
                  </Button>
                </div>
              )}
            </CardContent>
            </Card>

            {/* Right: Template Management */}
            <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Şablon Yönetimi</CardTitle>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
                <span>SABLON</span>
                <span>BAGLI ASSETLER</span>
                <span>MADDE</span>
              </div>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Şablon bulunamadı.
                </p>
              ) : (
                <div className="space-y-2">
                  {templates.map((tpl) => {
                    const isExpanded = expandedId === tpl.id;
                    return (
                      <div key={tpl.id} className="rounded-md border border-border/50">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                          className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 p-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate text-sm font-medium">{tpl.name}</span>
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {tpl.templateAssets.length > 0
                              ? tpl.templateAssets
                                  .slice(0, 2)
                                  .map((ta) => ta.asset.name)
                                  .join(", ") +
                                (tpl.templateAssets.length > 2 ? " +" : "")
                              : "—"}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {tpl.items.length}
                          </Badge>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-border/50 bg-secondary/20 p-3">
                            <div className="space-y-2">
                              {tpl.templateAssets.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1">
                                  {tpl.templateAssets.map((ta) => (
                                    <Badge key={ta.id} variant="outline" className="text-[10px]">
                                      {ta.asset.name}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {tpl.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <span className="size-1.5 rounded-full bg-muted-foreground shrink-0" />
                                  <span className="flex-1">{item.label}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${typeBadgeColors[item.itemType] || ""}`}
                                  >
                                    {CHECKLIST_TYPE_LABELS[item.itemType as ChecklistItemType] ||
                                      item.itemType}
                                  </Badge>
                                  {item.unit && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {item.unit}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {tpl.items.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Bu şablonda madde yok.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            </Card>
          </div>

        </>
      )}

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Şablon Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Şablon Adı</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Günlük Kontrol Listesi"
              />
            </div>
            <div className="space-y-2">
              <Label>Bağlı Assetler</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {assets.map((asset) => {
                  const checked = selectedAssetIds.includes(asset.id);
                  return (
                    <label key={asset.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setSelectedAssetIds((prev) =>
                            value
                              ? prev.includes(asset.id)
                                ? prev
                                : [...prev, asset.id]
                              : prev.filter((id) => id !== asset.id)
                          );
                        }}
                      />
                      <span>{asset.name}</span>
                    </label>
                  );
                })}
                {assets.length === 0 && (
                  <p className="text-xs text-muted-foreground">Makine bulunamadı.</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Maddeler</Label>
                <Button variant="ghost" size="sm" onClick={addFormItem}>
                  <Plus className="size-3" />
                  Madde Ekle
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={item.label}
                      onChange={(e) => updateFormItem(idx, "label", e.target.value)}
                      placeholder={`Madde ${idx + 1}`}
                    />
                    <Select
                      value={item.itemType}
                      onValueChange={(val) => updateFormItem(idx, "itemType", val ?? "tick")}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tick">Onay (Tik)</SelectItem>
                        <SelectItem value="two_option">İki Seçenek</SelectItem>
                        <SelectItem value="three_option">Üç Seçenek</SelectItem>
                        <SelectItem value="numeric">Sayısal</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-red-400"
                        onClick={() => removeFormItem(idx)}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateTemplate} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
