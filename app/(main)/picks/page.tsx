import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PicksClient } from "./PicksClient";

export default async function PicksPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = parseInt(session.user.id);

  // The app operates on the currently open season
  const season = await prisma.season.findFirst({ where: { status: "open" } });

  // The active BetWeek is the one users currently pick from
  const activeBetWeek = season
    ? await prisma.betWeek.findFirst({
        where: { seasonId: season.id, status: "active" },
      })
    : null;

  const activeSchedules = activeBetWeek
    ? await prisma.schedule.findMany({
        where: { betWeekId: activeBetWeek.id },
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
      activeBetWeek={activeBetWeek}
      activeSchedules={activeSchedules}
    />
  );
}
