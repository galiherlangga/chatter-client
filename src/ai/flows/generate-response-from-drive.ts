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
    const knowledgeImages = await getImagesFromKnowledgeSites();
    console.log(`Retrieved ${knowledgeImages.length} images.`);

    let imageInfo = "No images available.";
    if (knowledgeImages.length > 0) {
        imageInfo = `Available images: ${knowledgeImages.map((img) => `${img.name} (ID: ${img.id})`).join(", ")}`;
    }

    const enhancedInput = {
        ...input,
        availableImages: imageInfo,
    };

    const result = await generateResponseFromDriveFlow(enhancedInput);
    console.log("AI raw response:", result.response);

    const stepImageRegex =
        /\[image-step(\d+):\s*([^\]]+?)\s*\(ID:\s*([^)]+)\)\]/gi;
    let match;
    const requestedStepImages: Array<{
        stepNum: string;
        imageName: string;
        fileId: string;
    }> = [];

    console.log("Scanning response for step image references...");
    while ((match = stepImageRegex.exec(result.response)) !== null) {
        const stepNum = match[1]?.trim();
        const imageName = match[2]?.trim();
        const fileId = match[3]?.trim();
        if (stepNum && imageName && fileId) {
            console.log(
                `Found step ${stepNum} image reference: ${imageName} (ID: ${fileId})`,
            );
            requestedStepImages.push({ stepNum, imageName, fileId });
        }
    }

    console.log(`Total step images found: ${requestedStepImages.length}`);
    const cleanedResponse = result.response.replace(stepImageRegex, "").trim();
    console.log(
        "Cleaned response (after removing image tags):",
        cleanedResponse,
    );

    if (requestedStepImages.length > 0) {
        console.log("Processing step images for response...");

        // Deduplicate images by stepId + fileId combination
        const uniqueStepImages = requestedStepImages.reduce(
            (acc, current) => {
                const key = `${current.stepNum}-${current.fileId}`;
                if (
                    !acc.find(
                        (item) => `${item.stepNum}-${item.fileId}` === key,
                    )
                ) {
                    acc.push(current);
                }
                return acc;
            },
            [] as Array<{ stepNum: string; imageName: string; fileId: string }>,
        );

        console.log(
            `Deduplicated: ${requestedStepImages.length} -> ${uniqueStepImages.length} images`,
        );

        const imageUrls = uniqueStepImages
            .map(({ stepNum, fileId }) => {
                const image = knowledgeImages.find((img) => img.id === fileId);
                if (image) {
                    const stepId = `step-${stepNum}`;
                    console.log(
                        `Mapping step ${stepNum} to stepId: ${stepId}, fileId: ${fileId}`,
                    );
                    return {
                        id: image.id,
                        url: image.contentLink,
                        stepId,
                    };
                } else {
                    console.log(
                        `Warning: Image not found for fileId: ${fileId} (step ${stepNum})`,
                    );
                }
                return null;
            })
            .filter(Boolean) as Array<{
            id: string;
            url: string;
            stepId: string;
        }>;

        console.log(
            `Final image URLs with stepIds:`,
            imageUrls.map((img) => ({ stepId: img.stepId, id: img.id })),
        );

        return {
            response: cleanedResponse,
            imageUrls,
        };
    }

    return {
        response: cleanedResponse,
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

  Format your response using Markdown. If the answer includes a list or steps, use bullet points or numbered lists.

  Use the following data from Google Drive as context to answer the user's query.

  Google Drive Data:
  {{driveData}}

  User Query:
  {{query}}

  {{#if availableImages}}
  The following images are available to include in your response:
  {{availableImages}}

  If your response includes numbered steps and there are relevant images, you MUST embed them using the following format immediately after the step description.

  For numbered steps (e.g., 1., 2., 3.), use the following format:
  [image-step<step_number>: <image_name> (ID: <file_id>)]

  Example:
  1. Go to the login page. [image-step1: images/login-step/step1.png (ID: 123...)]
  2. Enter your credentials and click 'Sign In'. [image-step2: images/login-step/step2.png (ID: 456...)]
  3. You will be redirected to the dashboard. [image-step3: images/login-step/step3.png (ID: 789...)]

  IMPORTANT RULES:
  1. You MUST include the full image path and the (ID: <file_id>) part exactly as it appears in the "Available images" list.
  2. ONLY use the [image-step...] tag for numbered lists.
  3. DO NOT include any other image formats or general image tags.
  4. Ensure the tag is on the same line as the step it corresponds to.
  5. Only include images that are directly relevant to the step being described.
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
                imageUrls: [], // Initialize empty, will be populated by the main function
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
