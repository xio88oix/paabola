import { prisma } from "@/lib/db";
import { calculatePoints, DEFAULT_SCORING, type ScoringValues } from "@/lib/scoring";

/**
 * Reads the singleton ScoringConfig row, creating it with defaults if missing.
 * Returns the point values used by calculatePoints.
 */
export async function getScoringConfig(): Promise<ScoringValues> {
  const config = await prisma.scoringConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_SCORING },
  });
  return {
    exactScorePoints: config.exactScorePoints,
    correctResultPoints: config.correctResultPoints,
  };
}

/**
 * Recalculates and stores points for every pick belonging to the given BetWeek,
 * using the current ScoringConfig values.
 */
export async function scoreBetWeek(betWeekId: number): Promise<void> {
  const scoring = await getScoringConfig();
  const schedules = await prisma.schedule.findMany({
    where: { betWeekId },
    include: { picks: true },
  });

  for (const schedule of schedules) {
    for (const pick of schedule.picks) {
      const points = calculatePoints(
        pick.homeScore,
        pick.awayScore,
        schedule.homeScore,
        schedule.awayScore,
        scoring
      );
      await prisma.pick.update({ where: { id: pick.id }, data: { points } });
    }
  }
}
