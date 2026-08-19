import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBetWeekResults } from "@/lib/results";
import { ResultsClient } from "./ResultsClient";

export default async function ResultsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const currentUserId = parseInt(session.user.id);

  const season = await prisma.season.findFirst({ where: { status: "open" } });

  const betweeks = season
    ? await prisma.betWeek.findMany({
        where: { seasonId: season.id },
        orderBy: { week: "asc" },
      })
    : [];

  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Default to the most recent completed betweek, otherwise the latest available
  const completed = betweeks.filter((b) => b.status === "completed");
  const defaultBetWeek =
    completed[completed.length - 1] ?? betweeks[betweeks.length - 1] ?? null;

  const initialResults = defaultBetWeek
    ? await getBetWeekResults(defaultBetWeek.id, currentUserId)
    : { schedules: [], standings: [] };

  return (
    <ResultsClient
      betweeks={betweeks}
      users={users}
      currentUserId={currentUserId}
      defaultBetWeekId={defaultBetWeek?.id ?? null}
      initialResults={initialResults}
    />
  );
}
