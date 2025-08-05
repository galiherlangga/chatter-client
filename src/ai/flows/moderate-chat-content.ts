"use server";

/**
 * @fileOverview This file defines a Genkit flow for moderating chat content.
 *
 * - moderateChatContent - A function that moderates chat content and returns moderation feedback.
 * - ModerateChatContentInput - The input type for the moderateChatContent function.
 * - ModerateChatContentOutput - The return type for the moderateChatContent function.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const ModerateChatContentInputSchema = z.object({
    text: z.string().describe("The chat message text to moderate."),
});
export type ModerateChatContentInput = z.infer<
    typeof ModerateChatContentInputSchema
>;

const ModerateChatContentOutputSchema = z.object({
    isHarmful: z
        .boolean()
        .describe("Whether the chat content is considered harmful."),
    harmCategory: z
        .string()
        .optional()
        .describe("The category of harm identified, if any."),
    harmProbability: z
        .string()
        .optional()
        .describe("The probability of the identified harm, if any."),
    feedback: z.string().describe("Moderation feedback and suggestions."),
});
export type ModerateChatContentOutput = z.infer<
    typeof ModerateChatContentOutputSchema
>;

export async function moderateChatContent(
    input: ModerateChatContentInput,
): Promise<ModerateChatContentOutput> {
    return moderateChatContentFlow(input);
}

const moderateChatContentPrompt = ai.definePrompt({
    name: "moderateChatContentPrompt",
    input: { schema: ModerateChatContentInputSchema },
    output: { schema: ModerateChatContentOutputSchema },
    prompt: `You are a content moderation AI that checks chat messages for harmful content.

  Determine if the following chat message is harmful. If it is, identify the category of harm and the probability of that harm. Provide feedback and suggestions for moderation.

  Chat Message: {{{text}}}
  \n  Respond in the following JSON format:
  {
    "isHarmful": true or false,
    "harmCategory": "category of harm if isHarmful is true",
    "harmProbability": "probability of harm if isHarmful is true",
    "feedback": "moderation feedback and suggestions"
  }`,
    config: {
        safetySettings: [
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_ONLY_HIGH",
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
            },
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_LOW_AND_ABOVE",
            },
        ],
    },
});

const moderateChatContentFlow = ai.defineFlow(
    {
        name: "moderateChatContentFlow",
        inputSchema: ModerateChatContentInputSchema,
        outputSchema: ModerateChatContentOutputSchema,
    },
    async (input) => {
        // Implement retry mechanism for handling service overload
        const maxRetries = 3;
        let retries = 0;
        let lastError;

        while (retries < maxRetries) {
            try {
                const { output } = await moderateChatContentPrompt(input);
                return output!;
            } catch (error) {
                lastError = error;
                // Check if it's a service overload error (503)
                if (
                    error instanceof Error &&
                    error.toString().includes("503 Service Unavailable") &&
                    error.toString().includes("The model is overloaded")
                ) {
                    console.warn(
                        `Google AI service overloaded (attempt ${retries + 1}/${maxRetries}), retrying after delay...`,
                    );
                    // Exponential backoff: 1s, 2s, 4s
                    await new Promise((resolve) =>
                        setTimeout(resolve, 1000 * Math.pow(2, retries)),
                    );
                    retries++;
                } else {
                    // If it's a different error, don't retry
                    throw error;
                }
            }
        }

        // If we've exhausted retries, throw a more helpful error
        throw new Error(
            `Failed to moderate content after ${maxRetries} attempts due to service overload. Please try again later.`,
        );
    },
);
