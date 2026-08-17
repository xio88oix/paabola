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
  const { id, confirm } = await req.json();

  const season = await prisma.season.findUnique({ where: { id } });
  if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Count everything that hangs off this season so the caller knows the blast radius.
  const [matchweeks, betweeks, schedules, picks] = await Promise.all([
    prisma.matchweek.count({ where: { seasonId: id } }),
    prisma.betWeek.count({ where: { seasonId: id } }),
    prisma.schedule.count({ where: { seasonId: id } }),
    prisma.pick.count({ where: { schedule: { seasonId: id } } }),
  ]);
  const counts = { matchweeks, betweeks, schedules, picks };

  // No explicit confirmation → report the blast radius, delete nothing.
  if (confirm !== true) {
    return NextResponse.json({ requiresConfirmation: true, year: season.year, counts });
  }

  // Schedule/Matchweek/BetWeek → Season and Pick → Schedule are ON DELETE CASCADE,
  // so deleting the season removes the whole subtree in one statement.
  await prisma.season.delete({ where: { id } });

  return NextResponse.json({ ok: true, deleted: counts });
}
