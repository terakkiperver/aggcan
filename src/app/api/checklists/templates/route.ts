import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const categoryId = searchParams.get("categoryId");

  const where: Record<string, unknown> = {
    tenantId: session.tenantId,
    isActive: true,
  };
  if (categoryId) where.categoryId = categoryId;

  const templates = await prisma.checklistTemplate.findMany({
    where,
    include: {
      items: { orderBy: { displayOrder: "asc" } },
      category: { select: { id: true, name: true, code: true } },
      templateAssets: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          asset: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role !== "admin" && session.role !== "foreman") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, categoryId, assetIds, items } = body as {
    name?: string;
    categoryId?: string;
    assetIds?: string[];
    items?: Array<{
      label: string;
      itemType: string;
      assetId?: string;
      severity?: "critical" | "normal";
      isActive?: boolean;
      options?: string;
      unit?: string;
      minThreshold?: number;
      maxThreshold?: number;
      photoRequiredOnAbnormal?: boolean;
    }>;
  };

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const selectedAssetIds = Array.isArray(assetIds)
    ? [...new Set(assetIds.filter(Boolean))]
    : [];
  if (selectedAssetIds.length === 0) {
    return NextResponse.json(
      { error: "En az bir makine seçilmelidir." },
      { status: 400 }
    );
  }

  const validAssets = await prisma.asset.findMany({
    where: {
      tenantId: session.tenantId,
      isDeleted: false,
      id: { in: selectedAssetIds },
    },
    select: { id: true },
  });
  if (validAssets.length !== selectedAssetIds.length) {
    return NextResponse.json(
      { error: "Seçilen makinelerden bazıları geçersiz." },
      { status: 400 }
    );
  }

  const template = await prisma.checklistTemplate.create({
    data: {
      tenantId: session.tenantId,
      name,
      categoryId: categoryId || undefined,
      templateAssets: {
        create: selectedAssetIds.map((id, idx) => ({
          tenantId: session.tenantId,
          assetId: id,
          sortOrder: idx,
          isActive: true,
        })),
      },
      items: items
        ? {
            create: items.flatMap(
              (
                item,
                idx: number
              ) =>
                (item.assetId
                  ? [
                      {
                        label: item.label,
                        itemType: item.itemType,
                        assetId: item.assetId,
                        severity: item.severity ?? "normal",
                        isActive: item.isActive ?? true,
                        options: item.options,
                        unit: item.unit,
                        minThreshold: item.minThreshold,
                        maxThreshold: item.maxThreshold,
                        photoRequiredOnAbnormal: item.photoRequiredOnAbnormal ?? false,
                        displayOrder: idx,
                      },
                    ]
                  : selectedAssetIds.map((assetId) => ({
                      label: item.label,
                      itemType: item.itemType,
                      assetId,
                      severity: item.severity ?? "normal",
                      isActive: item.isActive ?? true,
                      options: item.options,
                      unit: item.unit,
                      minThreshold: item.minThreshold,
                      maxThreshold: item.maxThreshold,
                      photoRequiredOnAbnormal: item.photoRequiredOnAbnormal ?? false,
                      displayOrder: idx,
                    })))
            ),
          }
        : undefined,
    },
    include: {
      items: true,
      templateAssets: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { asset: { select: { id: true, name: true, code: true } } },
      },
    },
  });

  return NextResponse.json(template, { status: 201 });
}
