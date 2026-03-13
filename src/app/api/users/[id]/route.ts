import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { WORKER_JOB_TITLES } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const user = await prisma.user.findFirst({
    where: { id, tenantId: session.tenantId },
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
  });

  if (!user) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();
  const { fullName, phone, role, isActive, password, jobTitle } = body;

  const existing = await prisma.user.findFirst({
    where: { id, tenantId: session.tenantId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (phone !== undefined) data.phone = phone;
  if (role !== undefined) data.role = role;
  if (jobTitle !== undefined) {
    if (jobTitle && !WORKER_JOB_TITLES.includes(jobTitle)) {
      return NextResponse.json({ error: "Geçersiz personel unvanı." }, { status: 400 });
    }
    data.jobTitle = jobTitle;
  }
  if (role !== undefined && role !== "worker") {
    data.jobTitle = null;
  }
  if (isActive !== undefined) data.isActive = isActive;
  if (password) data.passwordHash = await hash(password, 12);

  const user = await prisma.user.update({
    where: { id },
    data,
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
  });

  return NextResponse.json(user);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const existing = await prisma.user.findFirst({
    where: { id, tenantId: session.tenantId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
