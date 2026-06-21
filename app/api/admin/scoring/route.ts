import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getScoringConfig } from "@/lib/scoring-config";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const config = await getScoringConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { exactScorePoints, correctResultPoints } = await req.json();
  const config = await prisma.scoringConfig.upsert({
    where: { id: 1 },
    update: { exactScorePoints, correctResultPoints },
    create: { id: 1, exactScorePoints, correctResultPoints },
  });
  return NextResponse.json(config);
}
