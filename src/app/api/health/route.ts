import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "NOT SET";
  // Mask password for logging
  const maskedUrl = dbUrl.replace(/:([^@]+)@/, ":***@");

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      dbHost: maskedUrl.split("@")[1]?.split("/")[0] || "unknown",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        dbHost: maskedUrl.split("@")[1]?.split("/")[0] || "unknown",
      },
      { status: 503 }
    );
  }
}
