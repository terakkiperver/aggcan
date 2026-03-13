import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function GET(
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

    const task = await prisma.task.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        asset: { include: { category: true } },
        assignee: {
          select: { id: true, fullName: true, username: true, role: true },
        },
        creator: {
          select: { id: true, fullName: true, username: true, role: true },
        },
        taskAssignments: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, role: true },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Görev bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch {
    return NextResponse.json(
      { error: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}

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
    const contentType = request.headers.get("content-type") || "";

    const existing = await prisma.task.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Görev bulunamadı." },
        { status: 404 }
      );
    }

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
          { error: "Görevi tamamlamak için fotoğraf zorunludur." },
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
      if (typeof body.description === "string") {
        data.description = body.description;
      }
      if (typeof body.status === "string") {
        data.status = body.status;
      }
      if (typeof body.priority === "string") {
        data.priority = body.priority;
      }
      if (typeof body.taskType === "string") {
        data.taskType = body.taskType;
      }
      if ("deadlineAt" in body) {
        if (!body.deadlineAt) {
          data.deadlineAt = null;
        } else {
          const parsedDeadlineAt = new Date(body.deadlineAt);
          if (Number.isNaN(parsedDeadlineAt.getTime())) {
            return NextResponse.json(
              { error: "Geçersiz termin tarihi." },
              { status: 400 }
            );
          }
          data.deadlineAt = parsedDeadlineAt;
        }
      }

      if (Array.isArray(body.assignedToIds)) {
        const normalizedAssigneeIds = [
          ...new Set(
            body.assignedToIds.filter(
              (v: unknown) => typeof v === "string" && v.trim()
            )
          ),
        ] as string[];

        if (normalizedAssigneeIds.length === 0) {
          return NextResponse.json(
            { error: "En az bir personel seçilmelidir." },
            { status: 400 }
          );
        }

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
            { error: "Görev yalnızca aktif personel veya ustabaşına atanabilir." },
            { status: 400 }
          );
        }

        data.assignedTo = normalizedAssigneeIds[0];
        data.taskAssignments = {
          deleteMany: {},
          createMany: {
            data: normalizedAssigneeIds.map((userId) => ({
              tenantId: session.tenantId,
              userId,
            })),
          },
        };
      }

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

    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        asset: { include: { category: true } },
        assignee: {
          select: { id: true, fullName: true, username: true, role: true },
        },
        creator: {
          select: { id: true, fullName: true, username: true, role: true },
        },
        taskAssignments: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, role: true },
            },
          },
        },
      },
    });

    return NextResponse.json(task);
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

    const existing = await prisma.task.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Görev bulunamadı." },
        { status: 404 }
      );
    }

    await prisma.task.delete({
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
