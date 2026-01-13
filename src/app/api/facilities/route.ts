import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const q = searchParams.get("q");
  const jurisdictionId = searchParams.get("jurisdiction");
  const state = searchParams.get("state");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = (page - 1) * limit;

  const where: Prisma.FacilityWhereInput = {};

  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { displayAddress: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  if (jurisdictionId) where.jurisdictionId = jurisdictionId;
  if (state) where.state = state.toUpperCase();

  try {
    const [facilities, total] = await Promise.all([
      prisma.facility.findMany({
        where,
        include: {
          jurisdiction: { select: { name: true, slug: true } },
        },
        orderBy: { lastInspectionDate: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.facility.count({ where }),
    ]);

    return NextResponse.json({
      facilities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch facilities" },
      { status: 500 }
    );
  }
}
