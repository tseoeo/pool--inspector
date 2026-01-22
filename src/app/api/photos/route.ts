import { NextRequest, NextResponse } from "next/server";

// Proxy Google Places photos to avoid exposing API key client-side
// Usage: /api/photos?ref=places/xxx/photos/yyy&maxWidth=400

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const photoRef = searchParams.get("ref");
  const maxWidth = searchParams.get("maxWidth") || "400";
  const maxHeight = searchParams.get("maxHeight") || "300";

  if (!photoRef) {
    return NextResponse.json({ error: "Missing photo reference" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY_1;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    // Google Places Photo API (New)
    const url = `https://places.googleapis.com/v1/${photoRef}/media?key=${apiKey}&maxWidthPx=${maxWidth}&maxHeightPx=${maxHeight}`;

    const response = await fetch(url, {
      headers: {
        "Accept": "image/*",
      },
    });

    if (!response.ok) {
      console.error(`Google Photos API error: ${response.status}`);
      return NextResponse.json({ error: "Failed to fetch photo" }, { status: response.status });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image with caching headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800", // Cache for 1 day client, 1 week CDN
      },
    });
  } catch (error) {
    console.error("Photo proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 });
  }
}
