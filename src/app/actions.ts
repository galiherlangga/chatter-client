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
    images?: { url: string; alt?: string; stepId?: string, needsDirectUrl?: boolean }[];
    suggestTicket?: boolean;
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
            return {
                response:
                    knowledgeBase +
                    " Would you like to create a ticket for this question so our team can follow up?",
                suggestTicket: true,
            };
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
            images = responseResult.imageUrls.map((imageData, index) => {
                // Check if the image data is a string or an object with stepId
                const isObject = typeof imageData !== "string";
                const url = isObject ? imageData.url : imageData;
                const stepId = isObject ? imageData.stepId : undefined;
                const fileId = isObject ? (imageData as any).id : null;


                console.log(
                    `Processing image URL (${index + 1}): ${url}${stepId ? `, step: ${stepId}` : ""}`,
                );

                // If we have a file ID, create a proxy URL
                if (fileId) {
                    return {
                        url: `/api/image-proxy?fileId=${fileId}`,
                        alt: `Related image ${index + 1} from knowledge base`,
                        stepId,
                    };
                }

                // Fallback for older data that might not have the ID
                if (!url.startsWith("http")) {
                    console.error(`Invalid image URL format: ${url}`);
                    return null;
                }

                // Extract file ID if it's a Google Drive URL
                const idMatch = url.match(/id=([^&]+)/);
                if (idMatch && idMatch[1]) {
                   const matchedFileId = idMatch[1];
                    return {
                        url: `/api/image-proxy?fileId=${matchedFileId}`,
                        alt: `Related image ${index + 1} from knowledge base`,
                        stepId,
                    };
                }

                // If we can't get a file ID, return null so it can be filtered
                return null;
            }).filter(img => img !== null);


            console.log(`Final image array for message:`, images);
        } else {
            console.log("No images included in the response");
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
