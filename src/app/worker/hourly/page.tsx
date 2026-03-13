"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  ChevronLeft,
  Loader2,
  Settings,
  Wrench,
  PauseCircle,
  Sparkles,
  Camera,
  X,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "working", label: "Çalışıyorum", icon: Settings, color: "var(--toys-green)", dim: "var(--toys-green-dim)" },
  { value: "maintenance", label: "Bakım", icon: Wrench, color: "var(--toys-orange)", dim: "var(--toys-orange-dim)" },
  { value: "waiting", label: "Bekliyorum", icon: PauseCircle, color: "var(--toys-blue)", dim: "var(--toys-blue-dim)" },
  { value: "cleaning", label: "Temizlik", icon: Sparkles, color: "var(--toys-purple)", dim: "var(--toys-purple-dim)" },
] as const;

export default function HourlyReportPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
  }

  async function handleSubmit() {
    if (!status) {
      toast.error("Durum seçimi zorunludur.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/hourly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });

      if (!res.ok) throw new Error();
      toast.success("Bildirim gönderildi!");
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
        <Clock className="h-5 w-5" style={{ color: "var(--toys-orange)" }} />
        <h1 className="text-xl font-bold text-foreground">Saatlik Bildirim</h1>
      </div>

      {/* Prompt card */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "rgba(240,165,0,0.3)", backgroundColor: "rgba(240,165,0,0.05)" }}
      >
        <div className="text-sm font-semibold text-foreground">Durum Bildirimi</div>
        <div className="mt-0.5 text-xs text-muted-foreground">Şu an ne yapıyorsunuz?</div>
      </div>

      {/* Status grid */}
      <div>
        <label className="mb-2 block font-mono text-xs font-semibold tracking-wider text-muted-foreground">
          DURUM SEÇ
        </label>
        <div className="grid grid-cols-2 gap-3">
          {STATUS_OPTIONS.map((opt) => {
            const selected = status === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className="flex flex-col items-center gap-2 rounded-xl border py-5 transition-colors active:scale-95"
                style={{
                  borderColor: selected ? opt.color : "var(--border)",
                  backgroundColor: selected ? opt.dim : "var(--card)",
                }}
              >
                <opt.icon
                  className="h-7 w-7"
                  style={{ color: selected ? opt.color : "var(--muted-foreground)" }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: selected ? opt.color : "var(--foreground)" }}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="mb-2 block font-mono text-xs font-semibold tracking-wider text-muted-foreground">
          NOT (İsteğe Bağlı)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ek bilgi yazın..."
          rows={2}
          className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Photo */}
      <div>
        <label className="mb-2 block font-mono text-xs font-semibold tracking-wider text-muted-foreground">
          FOTOĞRAF (İsteğe Bağlı)
        </label>
        {photoPreview ? (
          <div className="relative">
            <img
              src={photoPreview}
              alt="Önizleme"
              className="h-32 w-full rounded-xl border border-border object-cover"
            />
            <button
              onClick={clearPhoto}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        ) : (
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-5 text-sm text-muted-foreground transition-colors active:bg-muted">
            <Camera className="h-5 w-5" />
            Fotoğraf Çek / Seç
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !status}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-colors disabled:opacity-40"
        style={{ backgroundColor: "var(--toys-orange)" }}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {loading ? "Gönderiliyor..." : "Bildirimi Gönder →"}
      </button>
    </div>
  );
}
