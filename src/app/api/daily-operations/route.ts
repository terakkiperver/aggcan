import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    let deadlineFilter:
      | {
          gte: Date;
          lt: Date;
        }
      | undefined;

    if (date) {
      const start = new Date(`${date}T00:00:00`);
      if (Number.isNaN(start.getTime())) {
        return NextResponse.json(
          { error: "Geçersiz tarih parametresi." },
          { status: 400 }
        );
      }
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      deadlineFilter = { gte: start, lt: end };
    }

    const operations = await prisma.dailyOperation.findMany({
      where: {
        tenantId: session.tenantId,
        ...(deadlineFilter ? { deadlineAt: deadlineFilter } : {}),
      },
      include: {
        asset: {
          include: {
            category: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(operations);
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
