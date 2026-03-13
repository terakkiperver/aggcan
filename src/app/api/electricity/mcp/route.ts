import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

type PtfItem = {
  date: string;
  hour: string;
  price: number | null;
};

type FetchDayResult =
  | { ok: true; items: PtfItem[] }
  | { ok: false; message: string };

let cachedTgt: { value: string; expiresAt: number } | null = null;

function getTurkeyDateString(input: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(input);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function addOneDay(yyyyMmDd: string) {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const next = new Date(utc + 86_400_000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTurkeyHour(input: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(input);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  return Number.isNaN(hour) ? 0 : hour;
}

function extractItems(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;
  if (Array.isArray(data.items)) return data.items as Array<Record<string, unknown>>;
  if (data.body && typeof data.body === "object") {
    const body = data.body as Record<string, unknown>;
    if (Array.isArray(body.items)) return body.items as Array<Record<string, unknown>>;
  }
  if (data.data && typeof data.data === "object") {
    const nested = data.data as Record<string, unknown>;
    if (Array.isArray(nested.items)) return nested.items as Array<Record<string, unknown>>;
  }
  if (data.result && typeof data.result === "object") {
    const nested = data.result as Record<string, unknown>;
    if (Array.isArray(nested.items)) return nested.items as Array<Record<string, unknown>>;
  }
  return [];
}

function normalizeHour(value: unknown) {
  if (typeof value === "number") return String(value).padStart(2, "0");
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return String(numeric).padStart(2, "0");
    return value.trim().slice(0, 2).padStart(2, "0");
  }
  return "00";
}

function hourRangeLabel(hour: string) {
  const start = Number(hour);
  if (Number.isNaN(start)) return `${hour}:00`;
  const end = (start + 1) % 24;
  return `${String(start).padStart(2, "0")}:00-${String(end).padStart(2, "0")}:00`;
}

function getDateFromItem(item: Record<string, unknown>) {
  const raw = item.date;
  if (typeof raw !== "string" || !raw) return "";
  return raw.slice(0, 10);
}

function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "EPİAŞ yanıtı alınamadı.";
  const data = payload as Record<string, unknown>;
  const errors = data.errors;
  if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
    const first = errors[0] as Record<string, unknown>;
    if (typeof first.errorMessage === "string" && first.errorMessage.trim()) {
      return first.errorMessage;
    }
  }
  if (typeof data.status === "string" && data.status.trim()) return data.status;
  return "EPİAŞ yanıtı alınamadı.";
}

async function fetchPtfForDate(
  date: string,
  tgt: string,
  endTime: string = "23:59:59"
): Promise<FetchDayResult> {
  const response = await fetch("https://seffaflik.epias.com.tr/electricity-service/v1/markets/dam/data/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      TGT: tgt,
    },
    body: JSON.stringify({
      startDate: `${date}T00:00:00+03:00`,
      endDate: `${date}T${endTime}+03:00`,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      message: extractErrorMessage(payload),
    };
  }

  const items = extractItems(payload)
    .map((item) => {
      const hour = normalizeHour(item.hour);
      const numericPrice =
        typeof item.price === "number"
          ? item.price
          : typeof item.price === "string"
          ? Number(item.price)
          : null;

      return {
        date: getDateFromItem(item),
        hour,
        price:
          numericPrice === null || Number.isNaN(numericPrice)
            ? null
            : numericPrice,
      };
    })
    .filter((item) => item.date === date)
    .sort((a, b) => Number(a.hour) - Number(b.hour));

  return { ok: true, items };
}

async function getTgt(username: string, password: string) {
  const now = Date.now();
  if (cachedTgt && cachedTgt.expiresAt > now) {
    return cachedTgt.value;
  }

  const params = new URLSearchParams({ username, password });
  const response = await fetch("https://giris.epias.com.tr/cas/v1/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/plain",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const text = (await response.text()).trim();
  if (!response.ok || !text.startsWith("TGT-")) {
    throw new Error("TGT alınamadı");
  }

  // TGT dokümana göre 2 saat geçerli, güvenli tarafta kalmak için 110 dk cache.
  cachedTgt = { value: text, expiresAt: now + 110 * 60 * 1000 };
  return text;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const username = process.env.EPIAS_USERNAME;
    const password = process.env.EPIAS_PASSWORD;
    if (!username || !password) {
      return NextResponse.json(
        { error: "EPİAŞ bilgileri eksik. EPIAS_USERNAME ve EPIAS_PASSWORD tanımlanmalı." },
        { status: 500 }
      );
    }

    const today = getTurkeyDateString(new Date());
    const tomorrow = addOneDay(today);
    const turkeyHour = getTurkeyHour(new Date());
    const todayEndTime = turkeyHour < 14 ? "12:59:59" : "23:59:59";
    const tgt = await getTgt(username, password);

    const [todayResult, tomorrowResult] = await Promise.all([
      fetchPtfForDate(today, tgt, todayEndTime),
      fetchPtfForDate(tomorrow, tgt),
    ]);

    if (!todayResult.ok && !tomorrowResult.ok) {
      return NextResponse.json(
        {
          error: "EPİAŞ PTF verisi alınamadı.",
          details: {
            today: todayResult.message,
            tomorrow: tomorrowResult.message,
          },
        },
        { status: 502 }
      );
    }

    const todayItems = (todayResult.ok ? todayResult.items : []).map((item) => ({
      ...item,
      hourLabel: hourRangeLabel(item.hour),
    }));
    const tomorrowItems = (tomorrowResult.ok ? tomorrowResult.items : []).map((item) => ({
      ...item,
      hourLabel: hourRangeLabel(item.hour),
    }));

    return NextResponse.json({
      today,
      tomorrow,
      todayItems,
      tomorrowItems,
      warnings: {
        today: todayResult.ok ? null : todayResult.message,
        tomorrow: tomorrowResult.ok ? null : tomorrowResult.message,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Elektrik verisi alınırken hata oluştu." },
      { status: 500 }
    );
  }
}
