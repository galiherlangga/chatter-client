"use server";

import { moderateChatContent } from "@/ai/flows/moderate-chat-content";
import { generateResponseFromDrive } from "@/ai/flows/generate-response-from-drive";
import {
    getKnowledgeBase,
    getImagesFromKnowledgeSites,
    DriveImage,
    getCachedImageUrls,
    cacheImageUrls,
} from "@/services/google-drive";

export async function handleSendMessage(message: string): Promise<{
    response?: string;
    error?: string;
    images?: { url: string; alt?: string; stepId?: string }[];
}> {
    console.log("Processing message:", message);
    try {
        const moderationResult = await moderateChatContent({ text: message });

        if (moderationResult.isHarmful) {
            console.warn("Harmful content detected:", moderationResult);
            return {
                error: `Message flagged as harmful. ${moderationResult.feedback}`,
            };
        }

        const knowledgeBase = await getKnowledgeBase();

        // Check if the knowledge base returned an error string.
        if (knowledgeBase.startsWith("Error:")) {
            console.error(
                "Failed to get knowledge base from Google Drive:",
                knowledgeBase,
            );
            return {
                error: `I am having trouble accessing my knowledge base from Google Drive right now. Please ensure it's configured correctly and try again later.`,
            };
        }

        // Check for the "no documents found" case.
        if (
            knowledgeBase ===
            "I am sorry, I cannot answer this question based on the provided Google Drive data, as no relevant documents were found."
        ) {
            return { response: knowledgeBase };
        }

        // Fetch available images from knowledge sites
        const availableImages = await getImagesFromKnowledgeSites();
        console.log(
            `Available images from knowledge sites: ${availableImages.length}`,
        );

        // Try to get cached direct URLs for these images
        const cachedUrls = await getCachedImageUrls();

        // Log all available images for debugging
        if (availableImages.length > 0) {
            console.log("Available images:");
            availableImages.forEach((img, index) => {
                // Check if we have a cached direct URL for this image
                const cachedUrl = cachedUrls[img.id];

                if (
                    cachedUrl &&
                    cachedUrl.startsWith("https://lh3.googleusercontent.com/")
                ) {
                    console.log(
                        `  ${index + 1}. ${img.name} - ${cachedUrl} (cached)`,
                    );
                    // Use the cached direct URL
                    availableImages[index].contentLink = cachedUrl;
                } else {
                    // Extract the file ID for direct URL generation
                    const fileId = img.id;
                    // Format the content link to be directly accessible
                    const directLink = `https://drive.google.com/uc?export=view&id=${fileId}`;

                    console.log(`  ${index + 1}. ${img.name} - ${directLink}`);
                    // Update the contentLink to use the direct format
                    availableImages[index].contentLink = directLink;
                }
            });
        } else {
            console.warn("No images available from knowledge sites");
        }

        // Get response from AI
        const responseResult = await generateResponseFromDrive({
            query: message,
            driveData: knowledgeBase,
        });

        console.log("Response result:", responseResult);
        console.log("Image URLs:", responseResult.imageUrls);

        // Prepare response with possible images
        let images;

        if (responseResult.imageUrls && responseResult.imageUrls.length > 0) {
            console.log(
                `Including ${responseResult.imageUrls.length} images in response`,
            );

            // Map image URLs to the format expected by the chat component
            images = await Promise.all(
                responseResult.imageUrls.map(async (imageData, index) => {
                    // Check if the image data is a string or an object with stepId
                    const isObject = typeof imageData !== "string";
                    const url = isObject ? imageData.url : imageData;
                    const stepId = isObject ? imageData.stepId : undefined;

                    console.log(
                        `Processing image URL (${index + 1}): ${url}${stepId ? `, step: ${stepId}` : ""}`,
                    );

                    // Verify the URL is properly formatted
                    if (!url.startsWith("http")) {
                        console.error(`Invalid image URL format: ${url}`);
                        return null;
                    }

                    // Extract file ID if it's a Google Drive URL
                    let finalUrl = url;
                    let fileId = null;
                    const idMatch = url.match(/id=([^&]+)/);
                    if (idMatch && idMatch[1]) {
                        fileId = idMatch[1];
                        // Check if we have a cached direct URL for this file ID
                        const cachedUrls = await getCachedImageUrls(); // Fixed: await now inside async map
                        if (
                            cachedUrls[fileId] &&
                            cachedUrls[fileId].startsWith(
                                "https://lh3.googleusercontent.com/",
                            )
                        ) {
                            finalUrl = cachedUrls[fileId];
                            console.log(
                                `Using cached direct URL for ${fileId}: ${finalUrl}`,
                            );
                        } else {
                            // Use export=view format which works better with CORS
                            finalUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                        }
                    }

                    // Add a cache-busting parameter to force refresh
                    const cacheBuster = Date.now();
                    const urlWithCacheBuster = finalUrl.includes("?")
                        ? `${finalUrl}&_cb=${cacheBuster}`
                        : `${finalUrl}?_cb=${cacheBuster}`;

                    return {
                        url: urlWithCacheBuster,
                        alt: `Related image ${index + 1} from knowledge base`,
                        originalFileId: fileId, // Store the original file ID for caching
                        stepId, // Include step association if present
                    };
                }),
            );

            console.log(`Final image array for message:`, images);
        } else {
            console.log("No images included in the response");
        }

        // Cache any direct image URLs we've found for future use
        if (images && images.length > 0) {
            const urlsToCache: Record<string, string> = {};

            images.forEach((image) => {
                if (
                    image &&
                    image.url.includes("googleusercontent.com") &&
                    image.originalFileId
                ) {
                    urlsToCache[image.originalFileId] = image.url;
                }
            });

            if (Object.keys(urlsToCache).length > 0) {
                await cacheImageUrls(urlsToCache);
                console.log("Cached direct image URLs for future use");
            }
        }

        // Create the final response object
        const responseData = {
            response: responseResult.response,
            images: images && images.length > 0 ? images : undefined,
        };

        // Log a summary of what we're returning
        console.log(
            `Sending response with ${images ? images.length : 0} images`,
        );
        console.log(
            `Response text length: ${responseResult.response.length} characters`,
        );
        if (images && images.length > 0) {
            console.log(
                "Image URLs in response:",
                images.map((img) => img.url),
            );
        }

        return responseData;
    } catch (e) {
        console.error(e);
        // Provide more specific error messages if possible
        const errorMessage =
            e instanceof Error ? e.message : "An unexpected error occurred.";
        return {
            error: `An unexpected error occurred while processing your message: ${errorMessage}`,
        };
    }
}
