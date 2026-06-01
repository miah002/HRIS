import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok", ts: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { status: "error", db: "unreachable", ts: new Date().toISOString(), error: String(err) },
      { status: 503 }
    );
  }
}
