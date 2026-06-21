import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  FootballDataError,
  fetchSeasonMatches,
  seasonStartYear,
  normalizeClub,
  displayName,
  logoSlug,
  downloadCrest,
  type FdTeam,
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
    const season = body.seasonId
      ? await prisma.season.findUnique({ where: { id: body.seasonId } })
      : await prisma.season.findFirst({ where: { status: "open" } });

    if (!season) {
      return NextResponse.json({ error: "No open season found to import into." }, { status: 400 });
    }

    // Importing rebuilds the season's fixtures, so refuse if picks already exist.
    const pickCount = await prisma.pick.count({ where: { schedule: { seasonId: season.id } } });
    if (pickCount > 0) {
      return NextResponse.json(
        { error: "This season already has picks. Import is for pre-season setup only; use Sync results instead." },
        { status: 400 }
      );
    }

    const startYear = seasonStartYear(season.year);
    const matches = await fetchSeasonMatches(startYear);
    if (matches.length === 0) {
      return NextResponse.json(
        { error: `football-data.org returned no fixtures for ${startYear}. The season may not be published yet.` },
        { status: 400 }
      );
    }

    // --- Resolve teams (match existing by externalId/name, else create) -----
    const existing = await prisma.team.findMany();
    const byExternal = new Map(existing.filter((t) => t.externalId != null).map((t) => [t.externalId!, t]));
    const byName = new Map(existing.map((t) => [normalizeClub(t.club), t]));
    const resolved = new Map<number, number>(); // fd team id -> Team.id
    let teamsCreated = 0;

    const uniqueTeams = new Map<number, FdTeam>();
    for (const m of matches) {
      uniqueTeams.set(m.homeTeam.id, m.homeTeam);
      uniqueTeams.set(m.awayTeam.id, m.awayTeam);
    }

    for (const fd of uniqueTeams.values()) {
      const name = displayName(fd);
      const logo = await downloadCrest(fd.crest, logoSlug(name));

      let team = byExternal.get(fd.id) ?? byName.get(normalizeClub(name)) ?? null;
      if (team) {
        team = await prisma.team.update({
          where: { id: team.id },
          data: { externalId: fd.id, ...(logo ? { logo } : {}) },
        });
      } else {
        team = await prisma.team.create({
          data: { club: name, externalId: fd.id, logo },
        });
        teamsCreated++;
      }
      resolved.set(fd.id, team.id);
    }

    // --- Clean rebuild of this season's weeks/fixtures ----------------------
    await prisma.schedule.deleteMany({ where: { seasonId: season.id } });
    await prisma.matchweek.deleteMany({ where: { seasonId: season.id } });
    await prisma.betWeek.deleteMany({ where: { seasonId: season.id } });

    // Group matches by matchday
    const byDay = new Map<number, typeof matches>();
    for (const m of matches) {
      const list = byDay.get(m.matchday) ?? [];
      list.push(m);
      byDay.set(m.matchday, list);
    }

    let scheduleCount = 0;
    let finishedCount = 0;
    const matchdays = [...byDay.keys()].sort((a, b) => a - b);

    for (const day of matchdays) {
      const mw = await prisma.matchweek.create({
        data: { week: day, status: "open", seasonId: season.id },
      });
      const bw = await prisma.betWeek.create({
        data: { week: day, status: "open", seasonId: season.id },
      });

      const games = byDay
        .get(day)!
        .sort((a, b) => a.utcDate.localeCompare(b.utcDate) || a.id - b.id);

      for (let i = 0; i < games.length; i++) {
        const g = games[i];
        const finished = g.status === "FINISHED";
        if (finished) finishedCount++;
        await prisma.schedule.create({
          data: {
            externalId: g.id,
            seasonId: season.id,
            matchweekId: mw.id,
            betWeekId: bw.id,
            gameNumber: i + 1,
            homeTeamId: resolved.get(g.homeTeam.id)!,
            awayTeamId: resolved.get(g.awayTeam.id)!,
            homeScore: finished ? g.score.fullTime.home : null,
            awayScore: finished ? g.score.fullTime.away : null,
          },
        });
        scheduleCount++;
      }
    }

    return NextResponse.json({
      season: season.year,
      teamsCreated,
      matchweeks: matchdays.length,
      betweeks: matchdays.length,
      schedules: scheduleCount,
      finishedWithScores: finishedCount,
    });
  } catch (e) {
    if (e instanceof FootballDataError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Schedule import failed:", e);
    return NextResponse.json({ error: "Schedule import failed. See server logs." }, { status: 500 });
  }
}
