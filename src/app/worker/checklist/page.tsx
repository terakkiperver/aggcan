"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ChevronLeft, Loader2, Camera, X } from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  assetId: string;
  label: string;
  itemType: string;
  options: string | null;
  unit: string | null;
  severity: "critical" | "normal";
  isActive: boolean;
  minThreshold: number | null;
  maxThreshold: number | null;
  photoRequiredOnAbnormal: boolean;
  displayOrder: number;
}

interface TemplateAssetRef {
  id: string;
  asset: { id: string; name: string; code: string };
}

interface Template {
  id: string;
  name: string;
  items: ChecklistItem[];
  category: { id: string; name: string; code: string } | null;
  templateAssets: TemplateAssetRef[];
}

interface EntryState {
  value: string;
  isAbnormal: boolean;
  note: string;
  photoFile: File | null;
  photoPreview: string | null;
}

export default function ChecklistPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [entries, setEntries] = useState<Record<string, EntryState>>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch("/api/checklists/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const templateAssets = selectedTemplate?.templateAssets ?? [];
  const currentAsset = templateAssets[currentAssetIndex]?.asset;

  function entryKey(assetId: string, itemId: string) {
    return `${assetId}:${itemId}`;
  }

  function itemsForAsset(template: Template, assetId: string) {
    return template.items.filter(
      (item) => item.isActive && item.assetId === assetId
    );
  }

  function initEntries(template: Template) {
    const init: Record<string, EntryState> = {};
    for (const ref of template.templateAssets) {
      const assetItems = itemsForAsset(template, ref.asset.id);
      for (const item of assetItems) {
        init[entryKey(ref.asset.id, item.id)] = {
          value: "",
          isAbnormal: false,
          note: "",
          photoFile: null,
          photoPreview: null,
        };
      }
    }
    setEntries(init);
  }

  function handleTemplateChange(id: string) {
    setSelectedTemplateId(id);
    setCurrentAssetIndex(0);
    const t = templates.find((t) => t.id === id);
    if (t) {
      initEntries(t);
    }
  }

  function updateEntry(assetId: string, itemId: string, updates: Partial<EntryState>) {
    const key = entryKey(assetId, itemId);
    setEntries((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  }

  function handleItemValue(assetId: string, item: ChecklistItem, value: string) {
    let isAbnormal = false;

    if (item.itemType === "two_option") {
      const opts = parseOptions(item.options);
      isAbnormal = opts.length >= 2 && value === opts[1];
    } else if (item.itemType === "three_option") {
      const opts = parseOptions(item.options);
      isAbnormal = opts.length >= 3 && (value === opts[1] || value === opts[2]);
    } else if (item.itemType === "numeric") {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        if (item.minThreshold != null && num < item.minThreshold) isAbnormal = true;
        if (item.maxThreshold != null && num > item.maxThreshold) isAbnormal = true;
      }
    }

    updateEntry(assetId, item.id, { value, isAbnormal });
  }

  function parseOptions(raw: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return raw.split(",").map((s) => s.trim());
    }
  }

  function handlePhotoChange(
    assetId: string,
    itemId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      updateEntry(assetId, itemId, {
        photoFile: file,
        photoPreview: reader.result as string,
      });
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!selectedTemplate) return;
    if (templateAssets.length === 0) {
      toast.error("Bu şablona bağlı makine bulunmuyor.");
      return;
    }

    setLoading(true);
    try {
      for (const ref of templateAssets) {
        const assetId = ref.asset.id;
        const assetItems = itemsForAsset(selectedTemplate, assetId);
        const entriesArr = assetItems.map((item) => {
          const e = entries[entryKey(assetId, item.id)];
          return {
            itemId: item.id,
            value: e?.value || "",
            isAbnormal: e?.isAbnormal || false,
            note: e?.note || undefined,
          };
        });

        if (entriesArr.length === 0) continue;

        const res = await fetch("/api/checklists/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedTemplate.id,
            assetId,
            entries: entriesArr,
          }),
        });
        if (!res.ok) throw new Error();
      }
      toast.success("Kontrol listesi kaydedildi!");
      router.push("/worker");
    } catch {
      toast.error("Bir hata oluştu. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/worker"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground active:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Geri
      </Link>

      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5" style={{ color: "var(--toys-blue)" }} />
        <h1 className="text-xl font-bold text-foreground">Kontrol Listesi</h1>
      </div>

      {fetching ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aktif şablon bulunamadı
        </div>
      ) : (
        <>
          <div>
            <label className="mb-2 block font-mono text-xs font-semibold tracking-wider text-muted-foreground">
              ŞABLON SEÇ
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
            >
              <option value="">Şablon seçin...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {selectedTemplate && (
            <div className="space-y-4">
              {currentAsset ? (
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">
                    Makine {currentAssetIndex + 1}/{templateAssets.length}
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {currentAsset.name}
                  </div>
                </div>
              ) : null}

              {currentAsset &&
                itemsForAsset(selectedTemplate, currentAsset.id).map((item, idx) => {
                const key = entryKey(currentAsset.id, item.id);
                const entry = entries[key];
                const opts = parseOptions(item.options);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border bg-card p-4"
                    style={{
                      borderColor: entry?.isAbnormal ? "var(--toys-red)" : "var(--border)",
                    }}
                  >
                    <div className="mb-3 text-sm font-medium text-foreground">
                      <span className="mr-2 text-muted-foreground">{idx + 1}.</span>
                      {item.label}
                    </div>

                    {item.itemType === "tick" && (
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
                        <input
                          type="checkbox"
                          checked={entry?.value === "true"}
                          onChange={(e) =>
                            handleItemValue(
                              currentAsset.id,
                              item,
                              e.target.checked ? "true" : "false"
                            )
                          }
                          className="h-5 w-5 accent-[var(--toys-blue)]"
                        />
                        <span className="text-sm text-foreground">Tamam</span>
                      </label>
                    )}

                    {item.itemType === "two_option" && (
                      <div className="grid grid-cols-2 gap-2">
                        {(opts.length >= 2 ? opts : ["Normal", "Anormal"]).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleItemValue(currentAsset.id, item, opt)}
                            className="rounded-lg border py-3 text-sm font-medium transition-colors active:scale-95"
                            style={{
                              borderColor:
                                entry?.value === opt
                                  ? opt === (opts[0] || "Normal")
                                    ? "var(--toys-green)"
                                    : "var(--toys-red)"
                                  : "var(--border)",
                              backgroundColor:
                                entry?.value === opt
                                  ? opt === (opts[0] || "Normal")
                                    ? "var(--toys-green-dim)"
                                    : "var(--toys-red-dim)"
                                  : "var(--card)",
                              color:
                                entry?.value === opt
                                  ? opt === (opts[0] || "Normal")
                                    ? "var(--toys-green)"
                                    : "var(--toys-red)"
                                  : "var(--foreground)",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {item.itemType === "three_option" && (
                      <div className="grid grid-cols-3 gap-2">
                        {(opts.length >= 3 ? opts : ["İyi", "Orta", "Kötü"]).map((opt, oi) => {
                          const colors = ["var(--toys-green)", "var(--toys-orange)", "var(--toys-red)"];
                          const dims = ["var(--toys-green-dim)", "var(--toys-orange-dim)", "var(--toys-red-dim)"];
                          return (
                            <button
                              key={opt}
                              onClick={() => handleItemValue(currentAsset.id, item, opt)}
                              className="rounded-lg border py-3 text-sm font-medium transition-colors active:scale-95"
                              style={{
                                borderColor: entry?.value === opt ? colors[oi] : "var(--border)",
                                backgroundColor: entry?.value === opt ? dims[oi] : "var(--card)",
                                color: entry?.value === opt ? colors[oi] : "var(--foreground)",
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {item.itemType === "numeric" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={entry?.value || ""}
                          onChange={(e) =>
                            handleItemValue(currentAsset.id, item, e.target.value)
                          }
                          placeholder="Değer"
                          className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground"
                        />
                        {item.unit && (
                          <span className="text-sm text-muted-foreground">{item.unit}</span>
                        )}
                      </div>
                    )}

                    {/* Abnormal photo capture */}
                    {entry?.isAbnormal && item.photoRequiredOnAbnormal && (
                      <div className="mt-3">
                        <div className="mb-1 text-xs font-medium" style={{ color: "var(--toys-red)" }}>
                          Anormal — fotoğraf gerekli
                        </div>
                        {entry.photoPreview ? (
                          <div className="relative">
                            <img
                              src={entry.photoPreview}
                              alt=""
                              className="h-32 w-full rounded-lg border border-border object-cover"
                            />
                            <button
                              onClick={() =>
                                updateEntry(currentAsset.id, item.id, {
                                  photoFile: null,
                                  photoPreview: null,
                                })
                              }
                              className="absolute right-2 top-2 rounded-full bg-black/60 p-1"
                            >
                              <X className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => fileRefs.current[key]?.click()}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-red-500/40 bg-red-500/5 py-4 text-xs text-muted-foreground"
                          >
                            <Camera className="h-4 w-4" />
                            Fotoğraf Çek
                          </button>
                        )}
                        <input
                          ref={(el) => {
                            fileRefs.current[key] = el;
                          }}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) =>
                            handlePhotoChange(currentAsset.id, item.id, e)
                          }
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {currentAsset && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentAssetIndex((prev) => Math.max(0, prev - 1))
                    }
                    disabled={currentAssetIndex === 0}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground disabled:opacity-40"
                  >
                    Onceki Makine
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentAssetIndex((prev) =>
                        Math.min(templateAssets.length - 1, prev + 1)
                      )
                    }
                    disabled={currentAssetIndex >= templateAssets.length - 1}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground disabled:opacity-40"
                  >
                    Sonraki Makine
                  </button>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: "var(--toys-blue)" }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {loading ? "Kaydediliyor..." : "Tum Makineleri Kaydet"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
