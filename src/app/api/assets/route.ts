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
    const categoryCode = searchParams.get("categoryCode");

    const assets = await prisma.asset.findMany({
      where: {
        tenantId: session.tenantId,
        isDeleted: false,
        ...(categoryCode ? { category: { code: categoryCode } } : {}),
      },
      include: {
        category: true,
      },
      orderBy: [
        { category: { displayOrder: "asc" } },
        { name: "asc" },
      ],
    });

    return NextResponse.json(assets);
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
