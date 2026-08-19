import { prisma } from "@/lib/db";

export interface ResultRow {
  id: number;
  gameNumber: number;
  homeTeam: { club: string; logo: string | null };
  awayTeam: { club: string; logo: string | null };
  homeScore: number | null;
  awayScore: number | null;
  pick: { homeScore: number | null; awayScore: number | null; points: number | null } | null;
}

export interface Standing {
  userId: number;
  name: string;
  total: number;
  rank: number;
}

export interface BetWeekResults {
  schedules: ResultRow[];
  standings: Standing[];
}

/**
 * Builds the Results view for a given BetWeek: the selected player's picks
 * against the actual scores, plus the standings (total points per player) for
 * that BetWeek with ranks.
 */
export async function getBetWeekResults(
  betWeekId: number,
  userId: number
): Promise<BetWeekResults> {
  const schedules = await prisma.schedule.findMany({
    where: { betWeekId },
    include: {
      homeTeam: true,
      awayTeam: true,
      picks: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { gameNumber: "asc" },
  });

  const rows: ResultRow[] = schedules.map((s) => {
    const pick = s.picks.find((p) => p.userId === userId) ?? null;
    return {
      id: s.id,
      gameNumber: s.gameNumber,
      homeTeam: { club: s.homeTeam.club, logo: s.homeTeam.logo },
      awayTeam: { club: s.awayTeam.club, logo: s.awayTeam.logo },
      homeScore: s.homeScore,
      awayScore: s.awayScore,
      pick: pick
        ? { homeScore: pick.homeScore, awayScore: pick.awayScore, points: pick.points }
        : null,
    };
  });

  // Aggregate points per player across this BetWeek
  const totals = new Map<number, { name: string; total: number }>();
  for (const s of schedules) {
    for (const p of s.picks) {
      const entry = totals.get(p.userId) ?? { name: p.user.name, total: 0 };
      entry.total += p.points ?? 0;
      totals.set(p.userId, entry);
    }
  }

  const standings: Standing[] = [...totals.entries()]
    .map(([uid, v]) => ({ userId: uid, name: v.name, total: v.total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return { schedules: rows, standings };
}

export interface SeasonStanding {
  userId: number;
  name: string;
  total: number;
}

/**
 * Season-cumulative standings: total points per player across all COMPLETED
 * betweeks. Pass a seasonId to scope to a single season; omit for all seasons
 * (matches the historical leaderboard behavior). Sorted by total desc, name asc.
 */
export async function getSeasonStandings(seasonId?: number): Promise<SeasonStanding[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      picks: {
        where: {
          points: { not: null },
          schedule: {
            betWeek: {
              status: "completed",
              ...(seasonId ? { seasonId } : {}),
            },
          },
        },
        select: { points: true },
      },
    },
  });

  return users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      total: u.picks.reduce((sum, p) => sum + (p.points ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
