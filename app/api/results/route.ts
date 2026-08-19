import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBetWeekResults } from "@/lib/results";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const betWeekId = searchParams.get("betWeekId");
  const userId = searchParams.get("userId");

  if (!betWeekId || !userId) {
    return NextResponse.json({ error: "betWeekId and userId are required" }, { status: 400 });
  }

  const results = await getBetWeekResults(parseInt(betWeekId), parseInt(userId));
  return NextResponse.json(results);
}
