import { NextRequest, NextResponse } from "next/server";
import { getImageData } from "@/services/google-drive";

/**
 * API endpoint to proxy images from Google Drive.
 * This avoids CORS issues that occur when trying to load Google Drive images directly on the client.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json(
      { error: "Missing required query parameter: fileId" },
      { status: 400 },
    );
  }

  try {
    const { stream, contentType } = await getImageData(fileId);

    if (!stream) {
      return NextResponse.json(
        { error: "Image not found or could not be streamed." },
        { status: 404 },
      );
    }
    
    // In Next.js, we can return a ReadableStream directly in the response.
    // We must also set the appropriate content type header.
    return new NextResponse(stream, {
        headers: {
            'Content-Type': contentType || 'application/octet-stream',
            'Cache-Control': 'public, max-age=604800, immutable', // Cache for 7 days
        },
    });

  } catch (error) {
    console.error(`Error proxying image for fileId ${fileId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to proxy image.", details: errorMessage },
      { status: 500 },
    );
  }
}
