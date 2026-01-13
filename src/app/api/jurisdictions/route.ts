import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const jurisdictions = await prisma.jurisdiction.findMany({
      include: {
        _count: {
          select: { facilities: true },
        },
      },
      orderBy: [{ state: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ jurisdictions });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch jurisdictions" },
      { status: 500 }
    );
  }
}
