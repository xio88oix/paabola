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
  const { picks } = body as { picks: Array<{ scheduleId: number; homeScore: number; awayScore: number }> };

  if (!picks || !Array.isArray(picks)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Verify the betweek is active
  if (picks.length > 0) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: picks[0].scheduleId },
      include: { betWeek: true },
    });
    if (!schedule || schedule.betWeek.status !== "active") {
      return NextResponse.json({ error: "Betweek is not active" }, { status: 400 });
    }
  }

  const userId = parseInt(session.user.id);

  const upserted = await Promise.all(
    picks.map((pick) =>
      prisma.pick.upsert({
        where: { userId_scheduleId: { userId, scheduleId: pick.scheduleId } },
        create: { userId, scheduleId: pick.scheduleId, homeScore: pick.homeScore, awayScore: pick.awayScore },
        update: { homeScore: pick.homeScore, awayScore: pick.awayScore },
      })
    )
  );

  return NextResponse.json(upserted);
}
