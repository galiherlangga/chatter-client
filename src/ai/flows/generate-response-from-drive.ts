"use server";

/**
 * @fileOverview A flow to generate responses based on data from Google Drive.
 *
 * - generateResponseFromDrive - A function that generates a response based on a query and data from Google Drive.
 * - GenerateResponseFromDriveInput - The input type for the generateResponseFromDrive function.
 * - GenerateResponseFromDriveOutput - The return type for the generateResponseFromDrive function.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";
import {
    DriveImage,
    getImagesFromKnowledgeSites,
} from "@/services/google-drive";

const GenerateResponseFromDriveInputSchema = z.object({
    query: z.string().describe("The user query to answer."),
    driveData: z
        .string()
        .describe(
            "The text content from Google Drive documents to use as context.",
        ),
});
export type GenerateResponseFromDriveInput = z.infer<
    typeof GenerateResponseFromDriveInputSchema
>;

const GenerateResponseFromDriveOutputSchema = z.object({
    response: z
        .string()
        .describe("The text response generated from the Google Drive data."),
    imageUrls: z
        .array(
            z.union([
                z.string(),
                z.object({
                    id: z.string(),
                    url: z.string(),
                    stepId: z.string().optional(),
                }),
            ]),
        )
        .optional()
        .describe(
            "URLs of relevant images to include with the response, optionally with step associations",
        ),
});
export type GenerateResponseFromDriveOutput = z.infer<
    typeof GenerateResponseFromDriveOutputSchema
>;

// Helper type for image references with step associations
type ImageWithStepId = {
    url: string;
    stepId?: string;
};

export async function generateResponseFromDrive(
    input: GenerateResponseFromDriveInput,
): Promise<GenerateResponseFromDriveOutput> {
    // Get available images from knowledge sites first
    const knowledgeImages = await getImagesFromKnowledgeSites();

    console.log(
        `Retrieved ${knowledgeImages.length} images from knowledge sites`,
    );

    // Prepare image names for AI prompt
    let imageInfo = "No images available.";
    if (knowledgeImages.length > 0) {
        // Log all available images for debugging
        knowledgeImages.forEach((img, i) => {
            console.log(`Image ${i + 1}: ${img.name} - ${img.contentLink} (ID: ${img.id})`);
        });

        imageInfo = `Available images: ${knowledgeImages.map((img) => `${img.name} (ID: ${img.id})`).join(", ")}`;
    }

    // Add image information to the input
    // If query specifically mentions login or steps, highlight those images
    const isLoginRelated =
        input.query.toLowerCase().includes("login") ||
        input.query.toLowerCase().includes("sign in") ||
        input.query.toLowerCase().includes("signin") ||
        input.query.toLowerCase().includes("steps");

    // Organize available images by type
    let loginImages = knowledgeImages
        .filter(
            (img) =>
                img.name.toLowerCase().includes("login") ||
                img.name.toLowerCase().includes("step"),
        )
        .map((img) => `${img.name} (ID: ${img.id})`);

    // Highlight relevant images based on query
    if (isLoginRelated && loginImages.length > 0) {
        imageInfo += `\n\nRelevant to your question, consider using these login/step images: ${loginImages.join(", ")}`;
    }

    const enhancedInput = {
        ...input,
        availableImages: imageInfo,
    };

    // Get the AI response with the enhanced input
    const result = await generateResponseFromDriveFlow(enhancedInput);
    console.log("AI raw response:", result.response);

    // Extract and process images if available
    if (knowledgeImages.length > 0) {
        // Parse the response to extract image references with step associations
        const generalImageRegex = /\[image:\s*([^\]]+)\]/gi;
        const stepImageRegex = /\[image-step(\d+):\s*([^\]]+)\]/gi;
        let match;
        const requestedImageNames: string[] = [];
        const requestedStepImages: Array<{
            stepNum: string;
            imageName: string;
        }> = [];
        let cleanedResponse = result.response;

        // Extract general image references from the response
        while ((match = generalImageRegex.exec(result.response)) !== null) {
            const imageName = match[1]?.trim();
            if (imageName) {
                console.log(`Found general image reference: ${imageName}`);
                requestedImageNames.push(imageName);
            }
        }

        // Extract step-specific image references
        while ((match = stepImageRegex.exec(result.response)) !== null) {
            const stepNum = match[1]?.trim();
            const imageName = match[2]?.trim();
            if (stepNum && imageName) {
                console.log(
                    `Found step ${stepNum} image reference: ${imageName}`,
                );
                requestedStepImages.push({ stepNum, imageName });
                requestedImageNames.push(imageName); // Also add to general list for finding
            }
        }

        // If no image references found but the response mentions specific image terms, try to find them
        if (requestedImageNames.length === 0) {
            // Common image-related terms that might indicate relevance
            const imageTerms = [
                "diagram",
                "chart",
                "picture",
                "image",
                "photo",
                "screenshot",
                "graph",
            ];

            // Look for mentions of image file extensions
            const extensionRegex = /\b\w+\.(jpg|jpeg|png|gif|svg|webp)\b/gi;
            while ((match = extensionRegex.exec(result.response)) !== null) {
                console.log(`Found image filename: ${match[0]}`);
                requestedImageNames.push(match[0]);
            }

            // Check if any image names appear directly in the response
            knowledgeImages.forEach((image) => {
                // Handle both full paths and just filenames
                const fullNameLower = image.name.toLowerCase();
                const fileNameOnly = image.name.split("/").pop() || "";
                const nameWithoutExtension = fileNameOnly
                    .split(".")[0]
                    .toLowerCase();

                if (
                    (result.response.toLowerCase().includes(fullNameLower) &&
                        fullNameLower.length > 3) ||
                    (result.response
                        .toLowerCase()
                        .includes(nameWithoutExtension) &&
                        nameWithoutExtension.length > 3) ||
                    (result.response.toLowerCase().includes(fileNameOnly) &&
                        fileNameOnly.length > 3)
                ) {
                    // Avoid false positives with very short names
                    console.log(`Found mention of image: ${image.name}`);
                    requestedImageNames.push(image.name);
                }
            });
        }

        // Remove all image references from the response
        cleanedResponse = cleanedResponse
            .replace(generalImageRegex, "")
            .replace(stepImageRegex, "")
            .trim();
        console.log(
            "Cleaned response (after removing image tags):",
            cleanedResponse,
        );

        // Find matching images or select random ones if appropriate
        let selectedImages: DriveImage[] = [];

        if (requestedImageNames.length > 0) {
            console.log(
                `Looking for ${requestedImageNames.length} requested images`,
            );

            // Find images that match the requested names (with fuzzy matching)
            selectedImages = knowledgeImages.filter((image) => {
                return requestedImageNames.some((name) => {
                    const imageLower = image.name.toLowerCase();
                    const nameLower = name.toLowerCase();

                    // Handle paths correctly - get just the filename if needed
                    const imageFilename =
                        imageLower.split("/").pop() || imageLower;
                    const nameFilename =
                        nameLower.split("/").pop() || nameLower;

                    // Check various matching conditions
                    const exactMatch = imageLower === nameLower;
                    const exactFilenameMatch = imageFilename === nameFilename;
                    const imageContainsName = imageLower.includes(nameLower);
                    const nameContainsImage = nameLower.includes(imageLower);
                    const filenameContainsName =
                        imageFilename.includes(nameFilename);
                    const nameContainsFilename =
                        nameFilename.includes(imageFilename);

                    // Split names by common separators for partial matching
                    const imageWords = imageFilename.split(/[_\-.\s]/);
                    const nameWords = nameFilename.split(/[_\-.\s]/);

                    // Check if any word in the image name matches any word in the requested name
                    const wordMatch = imageWords.some((imgWord) =>
                        nameWords.some(
                            (nameWord) =>
                                imgWord.length > 3 &&
                                nameWord.length > 3 &&
                                (imgWord.includes(nameWord) ||
                                    nameWord.includes(imgWord)),
                        ),
                    );

                    const matches =
                        exactMatch ||
                        exactFilenameMatch ||
                        imageContainsName ||
                        nameContainsImage ||
                        filenameContainsName ||
                        nameContainsFilename ||
                        wordMatch;
                    if (matches) {
                        console.log(
                            `Match found! "${image.name}" matches request "${name}"`,
                        );
                    }
                    return matches;
                });
            });

            console.log(`Found ${selectedImages.length} matching images`);
        }

        // If we didn't find any specific images but the answer would benefit from images
        // Select up to 2 relevant images from the collection
        if (selectedImages.length === 0 && knowledgeImages.length > 0) {
            // Only add images if the content seems to warrant it
            const imageRelevanceTerms = [
                "show",
                "visual",
                "illustrat",
                "diagram",
                "chart",
                "graph",
                "see",
                "look",
                "picture",
                "image",
                "photo",
                "display",
                "step",
                "process",
                "login",
                "screenshot",
                "interface",
                "ui",
                "screen",
            ];

            const mightBenefitFromImages = imageRelevanceTerms.some((term) =>
                cleanedResponse.toLowerCase().includes(term),
            );

            if (mightBenefitFromImages) {
                console.log(
                    "No specific images matched, but response might benefit from images",
                );

                // Look for contextually relevant images instead of random ones
                // Check for login-related content
                if (cleanedResponse.toLowerCase().includes("login")) {
                    const loginImages = knowledgeImages.filter(
                        (img) =>
                            img.name.toLowerCase().includes("login") ||
                            img.name.toLowerCase().includes("sign in"),
                    );
                    if (loginImages.length > 0) {
                        console.log("Found login-related images to include");
                        selectedImages = loginImages.slice(0, 2);
                    }
                }

                // If no contextual images found, fall back to the first 2 images
                if (selectedImages.length === 0) {
                    selectedImages = knowledgeImages.slice(0, 2);
                }
            }
        }

        // Limit to at most 3 images
        const limitedImages = selectedImages.slice(0, 3);
        console.log(`Using ${limitedImages.length} images in response`);

        // Return the cleaned response with selected image URLs and step associations
        if (limitedImages.length > 0) {
            return {
                response: cleanedResponse,
                imageUrls: limitedImages.map((img) => {
                    // Find if this image was associated with a specific step
                    const stepAssociation = requestedStepImages.find(
                        (stepImg) => {
                            const imageName = img.name.toLowerCase();
                            const requestedName =
                                stepImg.imageName.toLowerCase();
                            return (
                                imageName.includes(requestedName) ||
                                requestedName.includes(imageName)
                            );
                        },
                    );

                    // Add stepId property if this image was associated with a step
                    if (stepAssociation) {
                        return {
                            id: img.id,
                            url: img.contentLink,
                            stepId: `step-${stepAssociation.stepNum}`,
                        };
                    }

                    return {
                       id: img.id,
                       url: img.contentLink,
                    };
                }),
            };
        }
    }

    return {
        response: result.response,
        imageUrls: [],
    };
}

const generateResponseFromDrivePrompt = ai.definePrompt({
    name: "generateResponseFromDrivePrompt",
    input: {
        schema: GenerateResponseFromDriveInputSchema.extend({
            availableImages: z
                .string()
                .optional()
                .describe(
                    "List of available images that can be included in the response",
                ),
        }),
    },
    output: { schema: GenerateResponseFromDriveOutputSchema },
    prompt: `You are a helpful chat assistant that can answer questions based on data from Google Drive.

  Format your response using Markdown. If the answer includes a list or steps, use bullet points.

  Use the following data from Google Drive as context to answer the user's query.

  Google Drive Data:
  {{driveData}}

  User Query:
  {{query}}

  {{#if availableImages}}
  The following images are available to include in your response:
  {{availableImages}}

  If appropriate for your response, you can include images by adding tags to associate images with specific steps or sections:

  For numbered steps or bullet points, use the following format to link images directly to a step:
  - For Step 1: [image-step1: image_name (ID: file_id)]
  - For Step 2: [image-step2: image_name (ID: file_id)]
  - For Step 3: [image-step3: image_name (ID: file_id)]

  Examples:
  - Here's how to login (Step 1): [image-step1: images/login-step/step1.png (ID: 123...)]
  - Next, enter your credentials (Step 2): [image-step2: images/login-step/step2.png (ID: 456...)]
  - Finally, click Submit (Step 3): [image-step3: images/login-step/step3.png (ID: 789...)]

  You can also use the general format for non-step content:
  - Here's an important diagram: [image: flowchart.png (ID: abc...)]
  - This concept is illustrated in [image: concept_diagram.jpg (ID: def...)]

  Note:
  1. Images may be in subfolders like "images/login-step/". When referencing these images, include the full path as shown in the list.
  2. You MUST include the (ID: file_id) part when referencing an image.
  3. These images are publicly accessible and ready to be displayed directly.
  4. You don't need to worry about permissions or access rights - all listed images are available for use.
  5. When describing steps or processes, especially for login flows, ALWAYS include relevant images when available.

  Only add images when they are truly helpful for understanding your response. You can include up to 3 images.
  {{/if}}

  Response:`,
});

const generateResponseFromDriveFlow = ai.defineFlow(
    {
        name: "generateResponseFromDriveFlow",
        inputSchema: GenerateResponseFromDriveInputSchema.extend({
            availableImages: z.string().optional(),
        }),
        outputSchema: GenerateResponseFromDriveOutputSchema,
    },
    async (input) => {
        try {
            const { output } = await generateResponseFromDrivePrompt(input);

            // We'll handle image extraction in the main function
            return {
                response: output!.response,
                imageUrls: [], // Initialize empty, will be populated later if needed
            };
        } catch (error) {
            console.error("Error in AI response generation:", error);
            return {
                response:
                    "I apologize, but I encountered an error while generating a response. Could you please try asking your question again?",
                imageUrls: [],
            };
        }
    },
);
