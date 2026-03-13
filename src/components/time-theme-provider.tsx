"use client";

import { useEffect } from "react";

/** Sabah 07:00 – akşam 20:00 → light, geri kalan → dark */
function isDaytime(hour: number) {
  return hour >= 7 && hour < 20;
}

function applyTheme(mode: "auto" | "light" | "dark", hour: number) {
  const html = document.documentElement;
  html.classList.add("theme-transition");
  if (mode === "dark") {
    html.classList.add("dark");
  } else if (mode === "light") {
    html.classList.remove("dark");
  } else {
    if (isDaytime(hour)) {
      html.classList.remove("dark");
    } else {
      html.classList.add("dark");
    }
  }
  // transition sınıfını kaldır (bir sonraki frame'de animasyon bitsin)
  setTimeout(() => html.classList.remove("theme-transition"), 400);
}

function getThemeMode(): "auto" | "light" | "dark" {
  const stored = window.localStorage.getItem("toys-theme-mode");
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }
  return "auto";
}

export function TimeThemeProvider() {
  useEffect(() => {
    const applyNow = () => applyTheme(getThemeMode(), new Date().getHours());

    // İlk yüklemede uygula
    applyNow();

    // Her dakika kontrol et (gece/gündüz geçiş anında devreye girer)
    const interval = setInterval(() => {
      applyNow();
    }, 60_000);

    const onStorage = (event: StorageEvent) => {
      if (event.key === "toys-theme-mode") {
        applyNow();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
