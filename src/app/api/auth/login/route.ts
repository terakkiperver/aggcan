import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Kullanıcı adı ve şifre gereklidir." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        username,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Geçersiz kullanıcı adı veya şifre." },
        { status: 401 }
      );
    }

    const passwordValid = await compare(password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Geçersiz kullanıcı adı veya şifre." },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      tenantId: user.tenantId,
      fullName: user.fullName,
      role: user.role,
    });

    const cookie = sessionCookieOptions(token);
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
      },
    });

    response.cookies.set(cookie);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
