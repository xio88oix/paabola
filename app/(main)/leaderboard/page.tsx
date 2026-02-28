import { prisma } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function LeaderboardPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      picks: {
        where: { points: { not: null }, schedule: { matchweek: { status: "completed" } } },
        select: { points: true },
      },
    },
  });

  const ranked = users
    .map((u) => ({
      id: u.id,
      name: u.name,
      total: u.picks.reduce((sum, p) => sum + (p.points ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Total Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranked.map((user, i) => (
            <TableRow key={user.id} className={i === 0 ? "font-bold" : ""}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell className="text-right">{user.total}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
