import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboard() {
  const [userCount, teamCount, seasonCount, pickCount] = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.season.count(),
    prisma.pick.count(),
  ]);

  const stats = [
    { label: "Users", value: userCount },
    { label: "Teams", value: teamCount },
    { label: "Seasons", value: seasonCount },
    { label: "Total Picks", value: pickCount },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
