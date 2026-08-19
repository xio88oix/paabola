import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { userId } = await req.json();
  const token = `tok_${randomUUID().replace(/-/g, "")}`;
  const user = await prisma.user.update({
    where: { id: userId },
    data: { trmnlToken: token },
  });
  return NextResponse.json({ id: user.id, trmnlToken: user.trmnlToken });
}
