import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const matchweekId = searchParams.get("matchweekId");
  const userId = searchParams.get("userId") ?? session.user.id;

  const where: Record<string, unknown> = {
    schedule: matchweekId ? { matchweekId: parseInt(matchweekId) } : undefined,
    userId: parseInt(userId),
  };

  const picks = await prisma.pick.findMany({
    where,
    include: { schedule: { include: { homeTeam: true, awayTeam: true } } },
  });

  return NextResponse.json(picks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { betWeekId, picks } = body as {
    betWeekId: number;
    picks: Array<{ scheduleId: number; homeScore: number; awayScore: number }>;
  };

  if (typeof betWeekId !== "number" || !Array.isArray(picks)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Only the active betweek may be edited.
  const betWeek = await prisma.betWeek.findUnique({ where: { id: betWeekId } });
  if (!betWeek || betWeek.status !== "active") {
    return NextResponse.json({ error: "Betweek is not active" }, { status: 400 });
  }

  // Every submitted schedule must belong to this betweek (integrity guard).
  const betWeekScheduleIds = new Set(
    (await prisma.schedule.findMany({ where: { betWeekId }, select: { id: true } })).map((s) => s.id)
  );
  if (picks.some((p) => !betWeekScheduleIds.has(p.scheduleId))) {
    return NextResponse.json({ error: "Pick refers to a game outside this betweek" }, { status: 400 });
  }

  const userId = parseInt(session.user.id);
  const submittedIds = picks.map((p) => p.scheduleId);

  // Full sync: upsert the submitted (filled) picks, delete any of this user's
  // picks in this betweek that are no longer present (i.e. cleared on screen).
  await prisma.$transaction([
    ...picks.map((pick) =>
      prisma.pick.upsert({
        where: { userId_scheduleId: { userId, scheduleId: pick.scheduleId } },
        create: { userId, scheduleId: pick.scheduleId, homeScore: pick.homeScore, awayScore: pick.awayScore },
        update: { homeScore: pick.homeScore, awayScore: pick.awayScore },
      })
    ),
    prisma.pick.deleteMany({
      where: {
        userId,
        schedule: { betWeekId },
        ...(submittedIds.length > 0 ? { scheduleId: { notIn: submittedIds } } : {}),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, saved: submittedIds.length });
}
