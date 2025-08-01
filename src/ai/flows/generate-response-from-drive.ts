'use server';

/**
 * @fileOverview A flow to generate responses based on data from Google Drive.
 *
 * - generateResponseFromDrive - A function that generates a response based on a query and data from Google Drive.
 * - GenerateResponseFromDriveInput - The input type for the generateResponseFromDrive function.
 * - GenerateResponseFromDriveOutput - The return type for the generateResponseFromDrive function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type {drive_v3} from 'googleapis';

const GenerateResponseFromDriveInputSchema = z.object({
  query: z.string().describe('The user query to answer.'),
  driveData: z.string().describe('The text content from Google Drive documents to use as context.'),
  availableImages: z.record(z.any()).describe('A map of folder names to a list of available image files in that folder.'),
});
export type GenerateResponseFromDriveInput = z.infer<
  typeof GenerateResponseFromDriveInputSchema
>;

const GenerateResponseFromDriveOutputSchema = z.object({
  response: z.string().describe('The text response generated from the Google Drive data.'),
  imageUrl: z.string().optional().describe('The URL of a relevant image to display with the response.'),
});
export type GenerateResponseFromDriveOutput = z.infer<
  typeof GenerateResponseFromDriveOutputSchema
>;

export async function generateResponseFromDrive(
  input: GenerateResponseFromDriveInput
): Promise<GenerateResponseFromDriveOutput> {
  return generateResponseFromDriveFlow(input);
}

const generateResponseFromDrivePrompt = ai.definePrompt({
  name: 'generateResponseFromDrivePrompt',
  input: {schema: GenerateResponseFromDriveInputSchema},
  output: {schema: GenerateResponseFromDriveOutputSchema},
  prompt: `You are a helpful chat assistant that can answer questions based on data from Google Drive.

  Format your response using Markdown. If the answer includes a list or steps, use bullet points.

  When you formulate an answer, review the source text for a tag like "related images: [folder_name]".
  If you find such a tag and the user's query is related to that topic, look for the folder_name in the availableImages map.
  From that folder's image list, select the most relevant image and place its 'thumbnailLink' in the 'imageUrl' output field.
  Only select one image per response. If no image is relevant, leave imageUrl empty.

  Use the following data from Google Drive as context to answer the user's query.

  Google Drive Data:
  {{driveData}}

  Available Images Map:
  {{json availableImages}}

  User Query:
  {{query}}

  Response:`,
});

const generateResponseFromDriveFlow = ai.defineFlow(
  {
    name: 'generateResponseFromDriveFlow',
    inputSchema: GenerateResponseFromDriveInputSchema,
    outputSchema: GenerateResponseFromDriveOutputSchema,
  },
  async input => {
    const {output} = await generateResponseFromDrivePrompt(input);
    return output!;
  }
);