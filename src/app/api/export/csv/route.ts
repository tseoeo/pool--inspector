import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, InspectionResult } from "@prisma/client";

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDateCSV(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const jurisdiction = searchParams.get("jurisdiction");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const result = searchParams.get("result");
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10000"), 50000);

  const where: Prisma.InspectionEventWhereInput = {};

  if (jurisdiction) {
    where.facility = { jurisdiction: { slug: jurisdiction } };
  }

  if (from) {
    where.inspectionDate = { ...((where.inspectionDate as object) || {}), gte: new Date(from) };
  }

  if (to) {
    where.inspectionDate = { ...((where.inspectionDate as object) || {}), lte: new Date(to + "T23:59:59") };
  }

  if (result && result !== "ALL") {
    where.result = result as InspectionResult;
  }

  if (q) {
    where.facility = {
      ...((where.facility as object) || {}),
      displayName: { contains: q, mode: "insensitive" },
    };
  }

  try {
    const inspections = await prisma.inspectionEvent.findMany({
      where,
      include: {
        facility: {
          select: {
            displayName: true,
            displayAddress: true,
            city: true,
            state: true,
            zipCode: true,
            jurisdiction: { select: { name: true } },
          },
        },
      },
      orderBy: { inspectionDate: "desc" },
      take: limit,
    });

    // Build CSV
    const headers = [
      "Facility Name",
      "Address",
      "City",
      "State",
      "Zip",
      "Jurisdiction",
      "Inspection Date",
      "Inspection Type",
      "Result",
      "Score",
      "Demerits",
      "Is Closure",
      "Inspector Name",
      "Notes",
    ];

    const rows = inspections.map((i) => [
      escapeCSV(i.facility.displayName),
      escapeCSV(i.facility.displayAddress),
      escapeCSV(i.facility.city),
      escapeCSV(i.facility.state),
      escapeCSV(i.facility.zipCode),
      escapeCSV(i.facility.jurisdiction.name),
      formatDateCSV(i.inspectionDate),
      escapeCSV(i.inspectionType),
      escapeCSV(i.result),
      i.score !== null ? String(i.score) : "",
      i.demerits !== null ? String(i.demerits) : "",
      i.isClosure ? "Yes" : "No",
      escapeCSV(i.inspectorName),
      escapeCSV(i.notes),
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const today = new Date().toISOString().split("T")[0];
    const filename = `inspections-${today}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
