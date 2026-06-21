import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const seasons = await prisma.season.findMany({ orderBy: { year: "desc" } });
  return NextResponse.json(seasons);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { year, status } = await req.json();
  const season = await prisma.season.create({ data: { year, status: status ?? "open" } });
  return NextResponse.json(season);
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, year, status } = await req.json();
  const season = await prisma.season.update({
    where: { id },
    data: { year, ...(status !== undefined ? { status } : {}) },
  });
  return NextResponse.json(season);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  await prisma.season.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
