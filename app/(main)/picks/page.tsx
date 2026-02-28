import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PicksClient } from "./PicksClient";

export default async function PicksPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = parseInt(session.user.id);

  // Get all matchweeks for season 2026
  const matchweeks = await prisma.matchweek.findMany({
    where: { season: { year: 2026 } },
    orderBy: { week: "asc" },
  });

  const activeMatchweek = matchweeks.find((mw) => mw.status === "active") ?? null;
  const completedMatchweeks = matchweeks.filter((mw) => mw.status === "completed");

  // Load active matchweek schedules + picks
  const activeSchedules = activeMatchweek
    ? await prisma.schedule.findMany({
        where: { matchweekId: activeMatchweek.id },
        include: {
          homeTeam: true,
          awayTeam: true,
          picks: { where: { userId } },
        },
        orderBy: { gameNumber: "asc" },
      })
    : [];

  // Load completed matchweek schedules + picks (for the first completed week by default)
  const defaultCompleted = completedMatchweeks[completedMatchweeks.length - 1] ?? null;

  const completedSchedules = defaultCompleted
    ? await prisma.schedule.findMany({
        where: { matchweekId: defaultCompleted.id },
        include: {
          homeTeam: true,
          awayTeam: true,
          picks: { where: { userId } },
        },
        orderBy: { gameNumber: "asc" },
      })
    : [];

  return (
    <PicksClient
      userId={userId}
      matchweeks={matchweeks}
      activeMatchweek={activeMatchweek}
      activeSchedules={activeSchedules}
      completedMatchweeks={completedMatchweeks}
      defaultCompletedId={defaultCompleted?.id ?? null}
      initialCompletedSchedules={completedSchedules}
    />
  );
}
