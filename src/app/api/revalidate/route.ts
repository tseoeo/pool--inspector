import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.REVALIDATION_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, id, jurisdictionSlug } = body;

    switch (type) {
      case "facility":
        revalidatePath(`/facilities/${id}`);
        if (jurisdictionSlug) {
          revalidatePath(`/jurisdictions/${jurisdictionSlug}`);
        }
        break;
      case "jurisdiction":
        revalidatePath(`/jurisdictions/${id}`);
        break;
      case "closures":
        revalidatePath("/closures");
        break;
      case "all":
        revalidatePath("/", "layout");
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ revalidated: true, type, id });
  } catch (error) {
    return NextResponse.json(
      { error: "Revalidation failed" },
      { status: 500 }
    );
  }
}
