import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { WORKER_JOB_TITLES } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    const users = await prisma.user.findMany({
      where: {
        tenantId: session.tenantId,
        isActive: true,
        ...(role ? { role } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        username: true,
        role: true,
        jobTitle: true,
        phone: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: "asc" },
        { fullName: "asc" },
      ],
    });

    return NextResponse.json(users);
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const { fullName, username, password, role, phone, jobTitle } =
      await request.json();

    if (!fullName || !username || !password || !role) {
      return NextResponse.json(
        { error: "Tüm alanlar gereklidir." },
        { status: 400 }
      );
    }

    if (
      role === "worker" &&
      jobTitle &&
      !WORKER_JOB_TITLES.includes(jobTitle)
    ) {
      return NextResponse.json(
        { error: "Geçersiz personel unvanı." },
        { status: 400 }
      );
    }

    if (role === "admin") {
      const adminCount = await prisma.user.count({
        where: {
          tenantId: session.tenantId,
          role: "admin",
          isActive: true,
        },
      });
      if (adminCount >= 3) {
        return NextResponse.json(
          { error: "Maksimum 3 yönetici eklenebilir." },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        fullName,
        username,
        passwordHash,
        role,
        jobTitle: role === "worker" ? jobTitle ?? null : null,
        phone,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        jobTitle: true,
        phone: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Bu kullanıcı adı zaten kullanılıyor." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
