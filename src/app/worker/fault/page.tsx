"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Camera, ChevronLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface AssetOption {
  id: string;
  name: string;
  code: string;
}

const UNIT_OR_CATEGORY_OPTIONS = [
  { code: "U1", label: "Ünite 1" },
  { code: "U2", label: "Ünite 2" },
  { code: "U3", label: "Ünite 3" },
  { code: "TS", label: "Taşıt" },
  { code: "IM", label: "İş Makinesi" },
];

export default function FaultReportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [workImpact, setWorkImpact] = useState<"blocks_work" | "no_block" | "">(
    ""
  );
  const [description, setDescription] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);

  async function handleUnitSelect(code: string) {
    setSelectedUnit(code);
    setSelectedAsset("");
    setLoadingAssets(true);
    try {
      const categoryCandidates =
        code === "TS" || code === "TV" ? ["TS", "TV"] : [code];

      let loadedAssets: AssetOption[] = [];
      for (const categoryCode of categoryCandidates) {
        const res = await fetch(`/api/assets?categoryCode=${categoryCode}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          loadedAssets = data;
          break;
        }
      }

      setAssets(loadedAssets);
    } catch {
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!selectedAsset || !workImpact || !description.trim()) {
      toast.error("Makine, etki ve açıklama zorunludur.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("assetId", selectedAsset);
      fd.append("operationType", workImpact);
      fd.append("description", description.trim());
      if (photoFile) fd.append("photo", photoFile);

      const res = await fetch("/api/faults", { method: "POST", body: fd });
      if (!res.ok) throw new Error();

      toast.success("Arıza bildirimi gönderildi!");
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
        <AlertTriangle className="h-5 w-5" style={{ color: "var(--toys-red)" }} />
        <h1 className="text-xl font-bold text-foreground">Arıza Bildir</h1>
      </div>

      {/* Step 1: Unit / Vehicle */}
      <div>
        <label className="mb-2 block font-mono text-xs font-semibold tracking-wider text-muted-foreground">
          1. ÜNİTE/TAŞIT
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {UNIT_OR_CATEGORY_OPTIONS.map((u) => (
            <button
              type="button"
              key={u.code}
              onClick={() => handleUnitSelect(u.code)}
              className="rounded-xl border py-4 text-center text-sm font-semibold transition-colors active:scale-95"
              style={{
                borderColor: selectedUnit === u.code ? "var(--toys-red)" : "var(--border)",
                backgroundColor: selectedUnit === u.code ? "var(--toys-red-dim)" : "var(--card)",
                color: selectedUnit === u.code ? "var(--toys-red)" : "var(--foreground)",
              }}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Machine */}
      <div>
        <label className="mb-2 block font-mono text-xs font-semibold tracking-wider text-muted-foreground">
          2. MAKİNE SEÇ
        </label>
        {!selectedUnit ? (
          <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            Önce ünite/taşıt seçin
          </div>
        ) : loadingAssets ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            Bu seçimde makine bulunamadı
          </div>
        ) : (
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
          >
            <option value="">Makine seçin...</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Step 3: Work impact */}
      <div>
        <label className="mb-2 block font-mono text-xs font-semibold tracking-wider text-muted-foreground">
          3. ÇALIŞMAYA ETKİ
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWorkImpact("blocks_work")}
            className="rounded-xl border py-3 text-center text-sm font-semibold transition-colors active:scale-95"
            style={{
              borderColor:
                workImpact === "blocks_work"
                  ? "var(--toys-red)"
                  : "var(--border)",
              backgroundColor:
                workImpact === "blocks_work"
                  ? "var(--toys-red-dim)"
                  : "var(--card)",
              color:
                workImpact === "blocks_work"
                  ? "var(--toys-red)"
                  : "var(--foreground)",
            }}
          >
            Engeller
          </button>
          <button
            type="button"
            onClick={() => setWorkImpact("no_block")}
            className="rounded-xl border py-3 text-center text-sm font-semibold transition-colors active:scale-95"
            style={{
              borderColor:
                workImpact === "no_block" ? "var(--toys-blue)" : "var(--border)",
              backgroundColor:
                workImpact === "no_block"
                  ? "color-mix(in srgb, var(--toys-blue) 14%, transparent)"
                  : "var(--card)",
              color:
                workImpact === "no_block"
                  ? "var(--toys-blue)"
                  : "var(--foreground)",
            }}
          >
            Engellemez
          </button>
        </div>
      </div>

      {/* Step 4: Description */}
      <div>
        <label className="mb-2 block font-mono text-xs font-semibold tracking-wider text-muted-foreground">
          4. AÇIKLAMA
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Arızayı açıklayın..."
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Step 5: Photo */}
      <div>
        <label className="mb-2 block font-mono text-xs font-semibold tracking-wider text-muted-foreground">
          5. FOTOĞRAF (İsteğe Bağlı)
        </label>
        {photoPreview ? (
          <div className="relative">
            <img
              src={photoPreview}
              alt="Önizleme"
              className="h-40 w-full rounded-xl border border-border object-cover"
            />
            <button
              onClick={clearPhoto}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-6 text-sm text-muted-foreground transition-colors active:bg-muted"
          >
            <Camera className="h-5 w-5" />
            Fotoğraf Çek / Seç
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !selectedAsset || !workImpact || !description.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-colors disabled:opacity-40"
        style={{ backgroundColor: "var(--toys-red)" }}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {loading ? "Gönderiliyor..." : "Arızayı Gönder"}
      </button>
    </div>
  );
}
