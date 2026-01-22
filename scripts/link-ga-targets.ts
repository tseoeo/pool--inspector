import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const gaJurisdiction = await p.jurisdiction.findUnique({ where: { slug: "georgia-statewide" } });
  if (!gaJurisdiction) {
    console.log("GA jurisdiction not found");
    return;
  }
  console.log("Found Georgia jurisdiction:", gaJurisdiction.id);

  const result = await p.targetJurisdiction.updateMany({
    where: { state: "GA" },
    data: { jurisdictionId: gaJurisdiction.id, status: "INTEGRATED" }
  });
  console.log("Updated", result.count, "GA targets");

  const count = await p.targetJurisdiction.count({ where: { status: "INTEGRATED" } });
  console.log("Total integrated:", count);
}

main().finally(() => p.$disconnect());
