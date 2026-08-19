import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  FootballDataError,
  fetchMatchdayResults,
  seasonStartYear,
} from "@/lib/football-data";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const matchday = Number(body.matchday);
    if (!Number.isInteger(matchday)) {
      return NextResponse.json({ error: "A matchday number is required." }, { status: 400 });
    }

    const season = body.seasonId
      ? await prisma.season.findUnique({ where: { id: body.seasonId } })
      : await prisma.season.findFirst({ where: { status: "open" } });
    if (!season) {
      return NextResponse.json({ error: "No open season found." }, { status: 400 });
    }

    const startYear = seasonStartYear(season.year);
    const matches = await fetchMatchdayResults(startYear, matchday);

    let updated = 0;
    let notFound = 0;
    for (const m of matches) {
      const res = await prisma.schedule.updateMany({
        where: { externalId: m.id, seasonId: season.id },
        data: { homeScore: m.score.fullTime.home, awayScore: m.score.fullTime.away },
      });
      if (res.count > 0) updated += res.count;
      else notFound++;
    }

    return NextResponse.json({
      matchday,
      finishedReturned: matches.length,
      updated,
      notFound,
    });
  } catch (e) {
    if (e instanceof FootballDataError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Results sync failed:", e);
    return NextResponse.json({ error: "Results sync failed. See server logs." }, { status: 500 });
  }
}
