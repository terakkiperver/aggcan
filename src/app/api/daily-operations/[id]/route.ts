import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.dailyOperation.findFirst({
      where: {
        id,
        tenantId: session.tenantId,
      },
      include: {
        assignments: {
          select: { userId: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Günlük operasyon bulunamadı." },
        { status: 404 }
      );
    }

    const canUpdate =
      session.role === "admin" ||
      session.role === "foreman" ||
      existing.createdBy === session.userId ||
      existing.assignments.some((a) => a.userId === session.userId);

    if (!canUpdate) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    const data: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const status = (formData.get("status") as string | null) ?? "";
      const photo = formData.get("photo");
      const completionNote = (formData.get("completionNote") as string | null) ?? "";

      if (status !== "completed") {
        return NextResponse.json(
          { error: "Geçersiz durum güncellemesi." },
          { status: 400 }
        );
      }

      if (!(photo instanceof File) || photo.size === 0) {
        return NextResponse.json(
          { error: "Tamamlama için fotoğraf zorunludur." },
          { status: 400 }
        );
      }

      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      const ext = photo.name.split(".").pop() || "jpg";
      const filename = `${randomUUID()}.${ext}`;
      const filepath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await photo.arrayBuffer());
      await writeFile(filepath, buffer);

      const now = new Date();
      data.status = "completed";
      data.completedAt = now;
      data.completionNote = completionNote
        ? `${completionNote}\n\nTamamlama Fotoğrafı: /uploads/${filename}`
        : `Tamamlama Fotoğrafı: /uploads/${filename}`;

      if (existing.startedAt) {
        data.durationMinutes = Math.round(
          (now.getTime() - new Date(existing.startedAt).getTime()) / 60000
        );
      }
    } else {
      const body = await request.json();
      Object.assign(data, body);

      if (
        body.status === "in_progress" &&
        existing.status !== "in_progress" &&
        !existing.startedAt
      ) {
        data.startedAt = new Date();
      }

      if (
        (body.status === "completed" || body.status === "fault") &&
        existing.status !== "completed" &&
        existing.status !== "fault"
      ) {
        const now = new Date();
        data.completedAt = now;
        if (existing.startedAt) {
          data.durationMinutes = Math.round(
            (now.getTime() - new Date(existing.startedAt).getTime()) / 60000
          );
        }
      }
    }

    const updated = await prisma.dailyOperation.update({
      where: { id },
      data,
      include: {
        asset: { include: { category: true } },
        creator: {
          select: { id: true, fullName: true, username: true, role: true },
        },
        assignments: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, role: true },
            },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.dailyOperation.findFirst({
      where: {
        id,
        tenantId: session.tenantId,
      },
      select: {
        id: true,
        createdBy: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Günlük operasyon bulunamadı." },
        { status: 404 }
      );
    }

    const canDelete =
      session.role === "admin" ||
      session.role === "foreman" ||
      existing.createdBy === session.userId;

    if (!canDelete) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
    }

    await prisma.dailyOperation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
