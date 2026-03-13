"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Zap,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type HourlyPtfItem = {
  date: string;
  hour: string;
  hourLabel: string;
  price: number | null;
};

type ElectricityResponse = {
  today: string;
  tomorrow: string;
  todayItems: HourlyPtfItem[];
  tomorrowItems: HourlyPtfItem[];
  warnings?: {
    today?: string | null;
    tomorrow?: string | null;
  };
  fetchedAt: string;
};

type WorkingHoursRow = {
  date: string;
  electricity: number;
  total: number;
  h8: number;
  h9: number;
  h10: number;
  h11: number;
  h12: number;
  h13: number;
  h14: number;
  h15: number;
  h16: number;
  h17: number;
};

type WorkingHoursUnit = {
  unit: "U1" | "U2" | "U3";
  rows: WorkingHoursRow[];
};

type WorkingHoursResponse = {
  month: string;
  units: WorkingHoursUnit[];
};

const HOUR_COLUMNS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;
type HourColumn = (typeof HOUR_COLUMNS)[number];

function hourKey(hour: HourColumn): keyof WorkingHoursRow {
  return `h${hour}` as keyof WorkingHoursRow;
}

function formatDisplayDate(yyyyMmDd: string) {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  if (!year || !month || !day) return yyyyMmDd;
  return format(new Date(year, month - 1, day), "d MMMM yyyy, EEEE", { locale: tr });
}

function formatPrice(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getInitialMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return format(d, "LLLL yyyy", { locale: tr });
}

function formatHourValue(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatConsumptionValue(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function isZeroValue(value: number) {
  return Math.abs(value) < 0.0001;
}

function zeroOpacityClass(value: number) {
  return isZeroValue(value) ? "opacity-40" : "";
}

function PriceList({
  title,
  date,
  items,
  warning,
}: {
  title: string;
  date: string;
  items: HourlyPtfItem[];
  warning?: string | null;
}) {
  const numericPrices = items
    .map((item) => item.price)
    .filter((price): price is number => typeof price === "number");
  const minPrice = numericPrices.length ? Math.min(...numericPrices) : null;
  const maxPrice = numericPrices.length ? Math.max(...numericPrices) : null;

  const getCheapnessRatio = (price: number | null) => {
    if (price === null || minPrice === null || maxPrice === null) return 0;
    if (maxPrice === minPrice) return 1;
    // 1 => en ucuz saat, 0 => en pahalı saat
    return (maxPrice - price) / (maxPrice - minPrice);
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{formatDisplayDate(date)}</p>
        </div>
        {items.length === 0 ? (
          <div className="space-y-1 px-4 py-8 text-sm text-muted-foreground">
            <p>Veri bulunamadı.</p>
            {warning ? <p className="text-xs">{warning}</p> : null}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => {
              const cheapness = getCheapnessRatio(item.price);
              const shadeOpacity = Math.max(0, Math.min(0.36, cheapness * 0.36));
              return (
                <div
                  key={`${item.date}-${item.hour}`}
                  className="flex items-center justify-between px-4 py-2.5 transition-colors"
                  style={{
                    backgroundColor:
                      shadeOpacity > 0.03
                        ? `color-mix(in srgb, var(--toys-green) ${Math.round(
                            shadeOpacity * 100
                          )}%, transparent)`
                        : "transparent",
                  }}
                >
                  <span className="font-mono text-xs text-muted-foreground">{item.hourLabel}</span>
                  <span className="font-medium">{formatPrice(item.price)} TL/MWh</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ElectricityPage() {
  const [data, setData] = useState<ElectricityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());
  const [workingHoursData, setWorkingHoursData] = useState<WorkingHoursResponse | null>(
    null
  );
  const [workingLoading, setWorkingLoading] = useState(true);
  const [workingError, setWorkingError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/electricity/mcp", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setData(null);
        setError(payload?.error || "Elektrik verisi alınamadı.");
        return;
      }
      setData(payload as ElectricityResponse);
    } catch {
      setData(null);
      setError("Elektrik verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fetchWorkingHours = useCallback(async (month: string) => {
    setWorkingLoading(true);
    setWorkingError(null);
    try {
      const res = await fetch(
        `/api/electricity/working-hours?month=${encodeURIComponent(month)}`,
        { cache: "no-store" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWorkingHoursData(null);
        setWorkingError(payload?.error || "Çalışma saati verisi alınamadı.");
        return;
      }
      setWorkingHoursData(payload as WorkingHoursResponse);
    } catch {
      setWorkingHoursData(null);
      setWorkingError("Çalışma saati verisi alınamadı.");
    } finally {
      setWorkingLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorkingHours(selectedMonth);
  }, [fetchWorkingHours, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Zap className="size-6" />
            Elektrik
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bugün ve yarın saatlik kesinleşmiş Piyasa Takas Fiyatı (PTF)
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Yenile
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-sm">
            <p className="text-destructive">{error}</p>
            <Button type="button" size="sm" onClick={fetchData}>
              Tekrar Dene
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <PriceList
              title="Bugün"
              date={data.today}
              items={data.todayItems}
              warning={data.warnings?.today}
            />
            <PriceList
              title="Yarın"
              date={data.tomorrow}
              items={data.tomorrowItems}
              warning={data.warnings?.tomorrow}
            />
          </div>
          <Card className="h-full">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">U1 / U2 / U3 Aylık Çalışma Saatleri</p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => setSelectedMonth((prev) => shiftMonth(prev, -1))}
                    aria-label="Önceki ay"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <div className="min-w-28 text-center text-xs font-medium capitalize">
                    {formatMonthLabel(selectedMonth)}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => setSelectedMonth((prev) => shiftMonth(prev, 1))}
                    aria-label="Sonraki ay"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

              {workingLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : workingError ? (
                <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                  <p className="text-destructive">{workingError}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void fetchWorkingHours(selectedMonth)}
                  >
                    Tekrar Dene
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {(workingHoursData?.units ?? []).map((unit) => {
                    const electricitySum = unit.rows.reduce(
                      (acc, row) => acc + row.electricity,
                      0
                    );
                    const totalSum = unit.rows.reduce((acc, row) => acc + row.total, 0);
                    const hourSums = HOUR_COLUMNS.map((hour) =>
                      unit.rows.reduce(
                        (acc, row) => acc + (row[hourKey(hour)] as number),
                        0
                      )
                    );
                    const rowCount = unit.rows.length || 1;
                    const electricityAvg = electricitySum / rowCount;
                    const totalAvg = totalSum / rowCount;
                    const hourAvgs = hourSums.map((sum) => sum / rowCount);
                    const maxHourValue = Math.max(...hourSums, ...hourAvgs, 0);

                    const hourShadeStyle = (value: number) => {
                      if (maxHourValue <= 0 || value <= 0) return undefined;
                      const ratio = value / maxHourValue;
                      const opacity = Math.max(0.06, Math.min(0.32, ratio * 0.32));
                      return {
                        backgroundColor: `color-mix(in srgb, var(--toys-blue) ${Math.round(
                          opacity * 100
                        )}%, transparent)`,
                      };
                    };

                    return (
                      <div key={unit.unit} className="overflow-hidden rounded-md border border-border">
                        <div className="border-b border-border bg-muted/25 px-3 py-2 text-sm font-semibold">
                          {unit.unit}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-muted/20">
                              <tr>
                                <th className="bg-muted/50 pl-2 pr-1 py-2 text-left font-medium">Tarih</th>
                                <th className="bg-muted/50 pl-1 pr-1 py-2 text-right font-medium">
                                  Elektrik
                                </th>
                                <th className="bg-muted/50 pl-1 pr-4 py-2 text-right font-medium">Saat</th>
                                {HOUR_COLUMNS.map((hour, idx) => (
                                  <th
                                    key={hour}
                                    className={`${idx === 0 ? "pl-4 pr-2" : "px-2"} py-2 text-right font-medium`}
                                  >
                                    {hour}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {unit.rows.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={3 + HOUR_COLUMNS.length}
                                    className="px-2 py-4 text-center text-muted-foreground"
                                  >
                                    Bu ay için veri bulunamadı.
                                  </td>
                                </tr>
                              ) : (
                                <>
                                  {unit.rows.map((row) => (
                                    <tr key={`${unit.unit}-${row.date}`} className="border-t border-border/70">
                                      <td className="bg-muted/20 pl-2 pr-1 py-2 text-left font-medium">
                                        {row.date}
                                      </td>
                                      <td
                                        className={`bg-muted/20 pl-1 pr-1 py-2 text-right ${zeroOpacityClass(
                                          row.electricity
                                        )}`}
                                      >
                                        {formatConsumptionValue(row.electricity)}
                                      </td>
                                      <td
                                        className={`bg-muted/20 pl-1 pr-4 py-2 text-right font-medium ${zeroOpacityClass(
                                          row.total
                                        )}`}
                                      >
                                        {formatHourValue(row.total)}
                                      </td>
                                      {HOUR_COLUMNS.map((hour, idx) => {
                                        const value = row[hourKey(hour)] as number;
                                        return (
                                          <td
                                            key={`${unit.unit}-${row.date}-${hour}`}
                                            className={`${idx === 0 ? "pl-4 pr-2" : "px-2"} py-2 text-right ${zeroOpacityClass(
                                              value
                                            )}`}
                                            style={hourShadeStyle(value)}
                                          >
                                            {formatHourValue(value)}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}

                                  <tr className="border-t-2 border-border bg-muted/20 font-medium">
                                    <td className="bg-muted/30 pl-2 pr-1 py-2 text-left">Ortalama</td>
                                    <td
                                      className={`bg-muted/30 pl-1 pr-1 py-2 text-right ${zeroOpacityClass(
                                        electricityAvg
                                      )}`}
                                    >
                                      {formatConsumptionValue(electricityAvg)}
                                    </td>
                                    <td
                                      className={`bg-muted/30 pl-1 pr-4 py-2 text-right ${zeroOpacityClass(
                                        totalAvg
                                      )}`}
                                    >
                                      {formatHourValue(totalAvg)}
                                    </td>
                                    {HOUR_COLUMNS.map((hour, idx) => (
                                      <td
                                        key={`${unit.unit}-avg-${hour}`}
                                        className={`${idx === 0 ? "pl-4 pr-2" : "px-2"} py-2 text-right ${zeroOpacityClass(
                                          hourAvgs[idx]
                                        )}`}
                                        style={hourShadeStyle(hourAvgs[idx])}
                                      >
                                        {formatHourValue(hourAvgs[idx])}
                                      </td>
                                    ))}
                                  </tr>

                                  <tr className="border-t border-border bg-muted/30 font-semibold">
                                    <td className="bg-muted/40 pl-2 pr-1 py-2 text-left">Toplam</td>
                                    <td
                                      className={`bg-muted/40 pl-1 pr-1 py-2 text-right ${zeroOpacityClass(
                                        electricitySum
                                      )}`}
                                    >
                                      {formatConsumptionValue(electricitySum)}
                                    </td>
                                    <td
                                      className={`bg-muted/40 pl-1 pr-4 py-2 text-right ${zeroOpacityClass(
                                        totalSum
                                      )}`}
                                    >
                                      {formatHourValue(totalSum)}
                                    </td>
                                    {HOUR_COLUMNS.map((hour, idx) => (
                                      <td
                                        key={`${unit.unit}-sum-${hour}`}
                                        className={`${idx === 0 ? "pl-4 pr-2" : "px-2"} py-2 text-right ${zeroOpacityClass(
                                          hourSums[idx]
                                        )}`}
                                        style={hourShadeStyle(hourSums[idx])}
                                      >
                                        {formatHourValue(hourSums[idx])}
                                      </td>
                                    ))}
                                  </tr>
                                </>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Veri bulunamadı.</CardContent>
        </Card>
      )}
    </div>
  );
}
