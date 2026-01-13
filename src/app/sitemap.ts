import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://poolinspections.us";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/jurisdictions`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/closures`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Jurisdiction pages
  const jurisdictions = await prisma.jurisdiction.findMany({
    select: { slug: true, updatedAt: true },
  });

  const jurisdictionPages: MetadataRoute.Sitemap = jurisdictions.map((j) => ({
    url: `${baseUrl}/jurisdictions/${j.slug}`,
    lastModified: j.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Facility pages (top 10,000 by inspection count)
  const facilities = await prisma.facility.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { totalInspections: "desc" },
    take: 10000,
  });

  const facilityPages: MetadataRoute.Sitemap = facilities.map((f) => ({
    url: `${baseUrl}/facilities/${f.slug}`,
    lastModified: f.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...jurisdictionPages, ...facilityPages];
}
