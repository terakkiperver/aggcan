"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function WorkerLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        toast.error("Çıkış yapılamadı.");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Çıkış yapılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      className="h-7 gap-1.5 px-2 text-[11px]"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
      Çıkış
    </Button>
  );
}
