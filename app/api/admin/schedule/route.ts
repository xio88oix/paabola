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
  const matchweekId = searchParams.get("matchweekId");

  const schedules = await prisma.schedule.findMany({
    where: matchweekId ? { matchweekId: parseInt(matchweekId) } : undefined,
    include: { homeTeam: true, awayTeam: true, matchweek: true, betWeek: true },
    orderBy: { gameNumber: "asc" },
  });
  return NextResponse.json(schedules);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const schedule = await prisma.schedule.create({
    data: {
      seasonId: body.seasonId,
      matchweekId: body.matchweekId,
      betWeekId: body.betWeekId,
      gameNumber: body.gameNumber,
      homeTeamId: body.homeTeamId,
      awayTeamId: body.awayTeamId,
      homeScore: body.homeScore ?? null,
      awayScore: body.awayScore ?? null,
    },
    include: { homeTeam: true, awayTeam: true, betWeek: true },
  });
  return NextResponse.json(schedule);
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const schedule = await prisma.schedule.update({
    where: { id: body.id },
    data: {
      homeTeamId: body.homeTeamId,
      awayTeamId: body.awayTeamId,
      homeScore: body.homeScore ?? null,
      awayScore: body.awayScore ?? null,
      gameNumber: body.gameNumber,
      ...(body.betWeekId != null ? { betWeekId: body.betWeekId } : {}),
    },
    include: { homeTeam: true, awayTeam: true, betWeek: true },
  });
  return NextResponse.json(schedule);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  await prisma.pick.deleteMany({ where: { scheduleId: id } });
  await prisma.schedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
