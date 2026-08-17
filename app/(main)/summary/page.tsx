import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SummaryClient } from "./SummaryClient";

export default async function SummaryPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const season = await prisma.season.findFirst({ where: { status: "open" } });

  const completedBetWeeks = season
    ? await prisma.betWeek.findMany({
        where: { status: "completed", seasonId: season.id },
        orderBy: { week: "asc" },
      })
    : [];

  // Build summary: for each user, for each completed betweek, sum points
  const summaryData: Record<number, Record<number, number>> = {};

  for (const user of users) {
    summaryData[user.id] = {};
    for (const bw of completedBetWeeks) {
      const picks = await prisma.pick.findMany({
        where: {
          userId: user.id,
          schedule: { betWeekId: bw.id },
          points: { not: null },
        },
        select: { points: true },
      });
      summaryData[user.id][bw.id] = picks.reduce((sum, p) => sum + (p.points ?? 0), 0);
    }
  }

  return (
    <SummaryClient
      users={users}
      completedBetWeeks={completedBetWeeks}
      summaryData={summaryData}
      currentUserId={parseInt(session.user.id)}
    />
  );
}
