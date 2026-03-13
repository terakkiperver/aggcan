import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import path from "path";
import fs from "fs";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type UnitKey = "u1" | "u2" | "u3";

type WorkingRow = {
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

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonth(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || month < 1 || month > 12) return null;
  return value;
}

function formatDateTr(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function excelSerialToDate(value: unknown): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return null;
  return new Date(parsed.y, parsed.m - 1, parsed.d);
}

function toHours(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number((value * 24).toFixed(2));
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return Number((numeric * 24).toFixed(2));
    }
  }
  return 0;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return Number(numeric.toFixed(2));
    }
  }
  return 0;
}

function getCell(row: unknown[], index: number) {
  return index < row.length ? row[index] : null;
}

function resolveExcelPath() {
  const candidates = [
    path.resolve(process.cwd(), "data", "cons_electricity.xlsx"),
    path.resolve(process.cwd(), "cons_electricity.xlsx"),
    path.resolve(process.cwd(), "..", "cons_electricity.xlsx"),
    path.resolve(process.cwd(), "..", "..", "cons_electricity.xlsx"),
    "/Users/ilyasc/Desktop/aggcan/cons_electricity.xlsx",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error("cons_electricity.xlsx bulunamadı.");
}

function mapSheetRows(rows: unknown[][], month: string): WorkingRow[] {
  const result: WorkingRow[] = [];

  // İlk iki satır başlık bilgisi olduğu için veri üçüncü satırdan başlıyor.
  for (let i = 2; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const rawDate = getCell(row, 1);
    const date = excelSerialToDate(rawDate);
    if (!date) continue;
    if (toMonthKey(date) !== month) continue;

    result.push({
      date: formatDateTr(date),
      electricity: toNumber(getCell(row, 5)),
      total: toHours(getCell(row, 4)),
      h8: toHours(getCell(row, 12)),
      h9: toHours(getCell(row, 13)),
      h10: toHours(getCell(row, 14)),
      h11: toHours(getCell(row, 15)),
      h12: toHours(getCell(row, 16)),
      h13: toHours(getCell(row, 17)),
      h14: toHours(getCell(row, 18)),
      h15: toHours(getCell(row, 19)),
      h16: toHours(getCell(row, 20)),
      h17: toHours(getCell(row, 21)),
    });
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const monthParam = parseMonth(request.nextUrl.searchParams.get("month"));
    const selectedMonth = monthParam ?? toMonthKey(new Date());

    const excelPath = resolveExcelPath();
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Excel dosyası bulunamadı: ${excelPath}`);
    }
    const excelBuffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(excelBuffer, { type: "buffer", cellDates: false });

    const sheetMap: Record<UnitKey, string> = {
      u1: "DayHourWork_u1",
      u2: "DayHourWork_u2",
      u3: "DayHourWork_u3",
    };

    const units = (Object.entries(sheetMap) as Array<[UnitKey, string]>).map(
      ([unit, sheetName]) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = sheet
          ? (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][])
          : [];

        return {
          unit: unit.toUpperCase(),
          rows: mapSheetRows(rows, selectedMonth),
        };
      }
    );

    return NextResponse.json({
      month: selectedMonth,
      units,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Çalışma saati verisi okunamadı.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
