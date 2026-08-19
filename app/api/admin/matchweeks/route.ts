import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");
  const matchweeks = await prisma.matchweek.findMany({
    where: seasonId ? { seasonId: parseInt(seasonId) } : undefined,
    include: { season: true },
    orderBy: [{ seasonId: "asc" }, { week: "asc" }],
  });
  return NextResponse.json(matchweeks);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { week, seasonId } = await req.json();
  const mw = await prisma.matchweek.create({ data: { week, seasonId } });
  return NextResponse.json(mw);
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, week, seasonId } = await req.json();
  const mw = await prisma.matchweek.update({ where: { id }, data: { week, seasonId } });
  return NextResponse.json(mw);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  await prisma.pick.deleteMany({ where: { schedule: { matchweekId: id } } });
  await prisma.schedule.deleteMany({ where: { matchweekId: id } });
  await prisma.matchweek.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
