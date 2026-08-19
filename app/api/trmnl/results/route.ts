import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBetWeekResults, getSeasonStandings } from "@/lib/results";
import { buildTrmnlPayload } from "@/lib/trmnl";

// Reads live data + request query; never prerender.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { trmnlToken: token } });
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const season = await prisma.season.findFirst({ where: { status: "open" } });
  if (!season) {
    return NextResponse.json(
      buildTrmnlPayload({
        season: "",
        week: null,
        player: user.name,
        userId: user.id,
        weekRank: null,
        fixtures: [],
        standings: [],
      })
    );
  }

  const betweeks = await prisma.betWeek.findMany({
    where: { seasonId: season.id },
    orderBy: { week: "asc" },
  });
  // Most recently completed betweek, else the latest available, else none.
  const completed = betweeks.filter((b) => b.status === "completed");
  const betWeek = completed[completed.length - 1] ?? betweeks[betweeks.length - 1] ?? null;

  const standings = await getSeasonStandings(season.id);

  if (!betWeek) {
    return NextResponse.json(
      buildTrmnlPayload({
        season: season.year,
        week: null,
        player: user.name,
        userId: user.id,
        weekRank: null,
        fixtures: [],
        standings,
      })
    );
  }

  const results = await getBetWeekResults(betWeek.id, user.id);
  const weekRank = results.standings.find((s) => s.userId === user.id)?.rank ?? null;

  const payload = buildTrmnlPayload({
    season: season.year,
    week: betWeek.week,
    player: user.name,
    userId: user.id,
    weekRank,
    fixtures: results.schedules.map((r) => ({
      home: r.homeTeam.club,
      away: r.awayTeam.club,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      pickHome: r.pick?.homeScore ?? null,
      pickAway: r.pick?.awayScore ?? null,
      points: r.pick?.points ?? null,
    })),
    standings,
  });

  return NextResponse.json(payload);
}
