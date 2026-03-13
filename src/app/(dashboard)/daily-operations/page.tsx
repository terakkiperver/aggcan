import { DailyOperationSection } from "@/components/daily-operation-section";
import { PlusCircle } from "lucide-react";

export default function DailyOperationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <PlusCircle className="size-6" />
          Günlük Operasyon
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ünite bazlı genel operasyon görevi oluştur ve personel ata
        </p>
      </div>
      <DailyOperationSection />
    </div>
  );
}
