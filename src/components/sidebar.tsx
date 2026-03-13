"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  ClipboardPlus,
  ListOrdered,
  Plus,
  ListTodo,
  Users,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  FileBarChart,
  Settings,
  Smartphone,
  LogOut,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ThemeModeSwitcher } from "@/components/theme-mode-switcher";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "GENEL",
    items: [
      { label: "Gösterge Paneli", href: "/", icon: LayoutDashboard },
      { label: "Elektrik", href: "/electricity", icon: Zap },
    ],
  },
  {
    title: "GÖREVLER",
    items: [
      { label: "Günlük Operasyon", href: "/daily-operations", icon: Plus },
      { label: "Günlük Operasyon Listesi", href: "/daily-operations/list", icon: ListTodo },
      { label: "Görev Oluştur", href: "/tasks/new", icon: Plus },
      { label: "Görev Listesi", href: "/tasks", icon: ListTodo },
    ],
  },
  {
    title: "TAKİP",
    items: [
      { label: "Personel Takibi", href: "/workers", icon: Users },
      { label: "Makine Geçmişi", href: "/assets", icon: Wrench },
      { label: "Bildirilen Arızalar", href: "/faults", icon: AlertTriangle },
      { label: "Kontrol Listesi", href: "/checklists", icon: ClipboardCheck },
    ],
  },
  {
    title: "RAPORLAR",
    items: [
      { label: "Günlük Rapor", href: "/reports", icon: FileBarChart },
    ],
  },
  {
    title: "AYARLAR",
    items: [
      { label: "Kullanıcı Yönetimi", href: "/settings", icon: Settings },
    ],
  },
];

const workerLink: NavItem = {
  label: "Personel Görünümü",
  href: "/worker",
  icon: Smartphone,
};

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="px-5 pb-4 pt-6">
        <Image
          src="/can_logo.svg"
          alt="CAN Logo"
          width={51}
          height={51}
          className="mb-2 rounded-sm shadow-md shadow-black/25"
        />
        <h1 className="font-mono text-lg font-semibold tracking-wide text-primary">
          TESİS TAKİP
        </h1>
        <p className="font-mono text-[11px] text-muted-foreground">
          Operasyon Yönetimi
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-1.5 px-2 font-mono text-[10px] font-medium uppercase tracking-[2px] text-muted-foreground">
              {section.title}
            </p>
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                    active
                      ? "border-l-[3px] border-l-primary bg-primary/[0.07] pl-[7px] font-medium text-primary"
                      : "border-l-[3px] border-l-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        <Separator className="my-3" />

        {/* Worker view link */}
        <Link
          href={workerLink.href}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
            isActive(workerLink.href)
              ? "border-l-[3px] border-l-primary bg-primary/[0.07] pl-[7px] font-medium text-primary"
              : "border-l-[3px] border-l-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <workerLink.icon className="size-4 shrink-0" />
          {workerLink.label}
        </Link>
      </nav>

      {/* User section */}
      <div className="border-t border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
            TEMA
          </span>
          <ThemeModeSwitcher compact />
        </div>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-4 shrink-0" />
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
