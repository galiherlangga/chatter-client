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

const GenerateResponseFromDriveInputSchema = z.object({
  query: z.string().describe('The user query to answer.'),
  driveData: z.string().describe('The text content from Google Drive documents to use as context.'),
});
export type GenerateResponseFromDriveInput = z.infer<
  typeof GenerateResponseFromDriveInputSchema
>;

const GenerateResponseFromDriveOutputSchema = z.object({
  response: z.string().describe('The text response generated from the Google Drive data.'),
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

  Use the following data from Google Drive as context to answer the user's query.

  Google Drive Data:
  {{driveData}}

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
