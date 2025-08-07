import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

/**
 * Route handler to retrieve direct image URLs from Google Drive file IDs
 *
 * Uses Puppeteer to extract the actual lh3.googleusercontent.com URLs by:
 * 1. Loading the Google Drive viewer page
 * 2. Waiting for the image to load
 * 3. Extracting the image src attribute which contains the direct URL
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fileId } = body;

        if (!fileId) {
            return NextResponse.json(
                { error: "Missing required field: fileId" },
                { status: 400 },
            );
        }

        // Get the actual direct image URL using Puppeteer
        const directUrl = await getActualImageUrl(fileId);

        if (!directUrl) {
            // Fall back to standard format if Puppeteer extraction fails
            const fallbackUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
            console.log(
                `Failed to get direct URL, using fallback for ${fileId}: ${fallbackUrl}`,
            );
            return NextResponse.json({ url: fallbackUrl });
        }

        // Log successful URL generation
        console.log(`Retrieved direct URL for file ID ${fileId}: ${directUrl}`);

        return NextResponse.json({ url: directUrl });
    } catch (error) {
        console.error("Error getting direct image URL:", error);
        return NextResponse.json(
            { error: "Failed to get direct image URL" },
            { status: 500 },
        );
    }
}

/**
 * Uses Puppeteer to get the actual direct image URL from Google Drive
 *
 * @param fileId The Google Drive file ID
 * @returns The direct lh3.googleusercontent.com URL or null if extraction failed
 */
async function getActualImageUrl(fileId: string): Promise<string | null> {
    let browser = null;

    try {
        // Launch a headless browser
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        // Open a new page
        const page = await browser.newPage();

        // Navigate to the Google Drive file view
        await page.goto(`https://drive.google.com/file/d/${fileId}/view`, {
            waitUntil: "networkidle2",
            timeout: 30000,
        });

        // Wait for the image to load and extract its src
        await page.waitForSelector("img", { timeout: 5000 });

        const imageUrl = await page.evaluate(() => {
            const img = document.querySelector("img");
            return img ? img.src : null;
        });

        return imageUrl;
    } catch (error) {
        console.error("Error in Puppeteer extraction:", error);
        return null;
    } finally {
        // Always close the browser
        if (browser) {
            await browser.close();
        }
    }
}
