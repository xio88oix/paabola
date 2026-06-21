import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scoreBetWeek } from "@/lib/scoring-config";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");
  const betweeks = await prisma.betWeek.findMany({
    where: seasonId ? { seasonId: parseInt(seasonId) } : undefined,
    include: { season: true },
    orderBy: [{ seasonId: "asc" }, { week: "asc" }],
  });
  return NextResponse.json(betweeks);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { week, status, seasonId } = await req.json();
  const bw = await prisma.betWeek.create({ data: { week, status: status ?? "open", seasonId } });
  return NextResponse.json(bw);
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, week, status, seasonId } = await req.json();

  const bw = await prisma.betWeek.update({ where: { id }, data: { week, status, seasonId } });

  // When marking as completed, (re)calculate points for all picks in this betweek
  if (status === "completed") {
    await scoreBetWeek(id);
  }

  return NextResponse.json(bw);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  // Schedules require a betWeek; deleting a betweek with schedules attached is blocked.
  const scheduleCount = await prisma.schedule.count({ where: { betWeekId: id } });
  if (scheduleCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a betweek that still has fixtures assigned." },
      { status: 400 }
    );
  }
  await prisma.betWeek.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
