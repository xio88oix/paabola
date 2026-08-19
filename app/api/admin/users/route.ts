import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({ select: { id: true, name: true, isAdmin: true, trmnlToken: true } });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { name, password, isAdmin } = await req.json();
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, password: hashed, isAdmin: isAdmin ?? false } });
  return NextResponse.json({ id: user.id, name: user.name, isAdmin: user.isAdmin });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, name, password, isAdmin } = await req.json();
  const data: Record<string, unknown> = { name, isAdmin };
  if (password) data.password = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ id: user.id, name: user.name, isAdmin: user.isAdmin });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  await prisma.pick.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
