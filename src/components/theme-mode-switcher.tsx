"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ThemeMode = "auto" | "light" | "dark";

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem("toys-theme-mode");
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }
  return "auto";
}

function applyTheme(mode: ThemeMode) {
  const html = document.documentElement;
  const hour = new Date().getHours();
  const autoDark = hour < 7 || hour >= 20;
  const shouldDark = mode === "dark" || (mode === "auto" && autoDark);
  html.classList.add("theme-transition");
  if (shouldDark) {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
  setTimeout(() => html.classList.remove("theme-transition"), 400);
}

const OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "auto", label: "Oto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeModeSwitcher({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    setMode(getInitialMode());
  }, []);

  const handleMode = (nextMode: ThemeMode) => {
    setMode(nextMode);
    window.localStorage.setItem("toys-theme-mode", nextMode);
    applyTheme(nextMode);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-background p-0.5",
        compact ? "text-[10px]" : "text-xs"
      )}
      aria-label="Tema modu seçici"
    >
      {OPTIONS.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleMode(option.value)}
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
