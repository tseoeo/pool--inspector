import slugify from "slugify";
import { prisma } from "@/lib/prisma";

export function generateSlug(name: string, jurisdictionSlug?: string): string {
  const base = slugify(name, {
    lower: true,
    strict: true,
    trim: true,
  });

  return jurisdictionSlug ? `${base}-${jurisdictionSlug}` : base;
}

export async function generateUniqueSlug(
  name: string,
  jurisdictionId: string
): Promise<string> {
  // Get jurisdiction slug for suffix
  const jurisdiction = await prisma.jurisdiction.findUnique({
    where: { id: jurisdictionId },
    select: { slug: true },
  });

  const baseSlug = generateSlug(name, jurisdiction?.slug);

  // Check if slug exists
  const existing = await prisma.facility.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  });

  if (!existing) {
    return baseSlug;
  }

  // Add numeric suffix if exists
  let counter = 1;
  let candidateSlug = `${baseSlug}-${counter}`;

  while (
    await prisma.facility.findUnique({
      where: { slug: candidateSlug },
      select: { id: true },
    })
  ) {
    counter++;
    candidateSlug = `${baseSlug}-${counter}`;
  }

  return candidateSlug;
}
