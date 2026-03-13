import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

const ALLOWED_UNITS = ["U1", "U2", "U3"] as const;
const ALLOWED_ASSET_CATEGORY_CODES = ["TV", "IM"] as const;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const { unit, assetId, assignedToIds, deadlineDate, note } = await request.json();

    const normalizedAssigneeIds: string[] = Array.isArray(assignedToIds)
      ? [...new Set(assignedToIds.filter((v) => typeof v === "string" && v.trim()))]
      : [];

    if (normalizedAssigneeIds.length === 0) {
      return NextResponse.json(
        { error: "En az bir personel seçilmelidir." },
        { status: 400 }
      );
    }

    const usingAssetMode = typeof assetId === "string" && assetId.trim().length > 0;

    const assignees = await prisma.user.findMany({
      where: {
        id: { in: normalizedAssigneeIds },
        tenantId: session.tenantId,
        isActive: true,
        role: { in: ["worker", "foreman"] },
      },
      select: { id: true },
    });

    if (assignees.length !== normalizedAssigneeIds.length) {
      return NextResponse.json(
        { error: "Seçilen personellerden bazıları aktif değil." },
        { status: 400 }
      );
    }

    let asset: { id: string };
    let defaultDescription: string;

    if (usingAssetMode) {
      const selectedAsset = await prisma.asset.findFirst({
        where: {
          id: assetId,
          tenantId: session.tenantId,
          isDeleted: false,
        },
        include: {
          category: { select: { code: true } },
        },
      });

      if (!selectedAsset) {
        return NextResponse.json(
          { error: "Seçilen asset bulunamadı." },
          { status: 404 }
        );
      }

      if (
        !ALLOWED_ASSET_CATEGORY_CODES.includes(
          selectedAsset.category.code as (typeof ALLOWED_ASSET_CATEGORY_CODES)[number]
        )
      ) {
        return NextResponse.json(
          { error: "Yalnızca Taşıt ve İş Makinası assetleri seçilebilir." },
          { status: 400 }
        );
      }

      asset = { id: selectedAsset.id };
      defaultDescription = `${selectedAsset.name} günlük operasyon görevi`;
    } else {
      if (!unit || !ALLOWED_UNITS.includes(unit)) {
        return NextResponse.json(
          { error: "Geçersiz ünite seçimi." },
          { status: 400 }
        );
      }

      const category = await prisma.assetCategory.findFirst({
        where: {
          tenantId: session.tenantId,
          code: unit,
        },
        select: { id: true, code: true },
      });

      if (!category) {
        return NextResponse.json(
          { error: "Seçilen ünite bulunamadı." },
          { status: 404 }
        );
      }

      const generalAssetCode = `${unit}-GENEL-OPERASYON`;
      const generalAssetName = `${unit} Genel Operasyon`;

      asset = await prisma.asset.upsert({
        where: {
          tenantId_code: {
            tenantId: session.tenantId,
            code: generalAssetCode,
          },
        },
        update: {
          categoryId: category.id,
          name: generalAssetName,
          status: "active",
          isDeleted: false,
        },
        create: {
          tenantId: session.tenantId,
          categoryId: category.id,
          name: generalAssetName,
          code: generalAssetCode,
          status: "active",
          metadata: JSON.stringify({ isGeneralOperationAsset: true }),
        },
        select: { id: true },
      });
      defaultDescription = `${unit} günlük operasyon görevi`;
    }

    let deadlineAt = new Date();
    deadlineAt.setHours(23, 59, 59, 999);
    if (deadlineDate) {
      const parsed = new Date(`${String(deadlineDate)}T23:59:59.999`);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Geçersiz termin tarihi." },
          { status: 400 }
        );
      }
      deadlineAt = parsed;
    }

    const deadlineDayStart = new Date(deadlineAt);
    deadlineDayStart.setHours(0, 0, 0, 0);
    const deadlineDayEnd = new Date(deadlineDayStart.getTime() + 86_400_000);

    const existingForSameDay = await prisma.dailyOperation.findFirst({
      where: {
        tenantId: session.tenantId,
        assetId: asset.id,
        deadlineAt: {
          gte: deadlineDayStart,
          lt: deadlineDayEnd,
        },
      },
      select: { id: true },
    });

    if (existingForSameDay) {
      return NextResponse.json(
        {
          error:
            "Aynı gün için bu asset/ünite adına zaten günlük operasyon kaydı var.",
        },
        { status: 409 }
      );
    }

    const dailyOperation = await prisma.dailyOperation.create({
      data: {
        tenantId: session.tenantId,
        assetId: asset.id,
        createdBy: session.userId,
        status: "pending",
        deadlineAt,
        description: note || defaultDescription,
        assignments: {
          createMany: {
            data: normalizedAssigneeIds.map((userId) => ({
              tenantId: session.tenantId,
              userId,
            })),
          },
        },
      },
      include: {
        asset: { include: { category: true } },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(dailyOperation, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
