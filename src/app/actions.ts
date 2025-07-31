'use server';

import { moderateChatContent } from "@/ai/flows/moderate-chat-content";
import { generateResponseFromDrive } from "@/ai/flows/generate-response-from-drive";

export async function handleSendMessage(message: string): Promise<{ response?: string; error?: string }> {
  try {
    const moderationResult = await moderateChatContent({ text: message });

    if (moderationResult.isHarmful) {
      console.warn('Harmful content detected:', moderationResult);
      return { error: `Message flagged as harmful. ${moderationResult.feedback}` };
    }
    
    // Using mock data for Google Drive context as a real integration is not available.
    const driveData = "Your knowledge base indicates: ChatterClient is a cutting-edge chat application designed for real-time communication. It leverages GenAI for content moderation and generating context-aware responses from a knowledge base. The UI is built with Next.js and styled with TailwindCSS, featuring a calming blue color palette. The primary font is Inter.";

    const responseResult = await generateResponseFromDrive({
      query: message,
      driveData,
    });

    return { response: responseResult.response };

  } catch (e) {
    console.error(e);
    return { error: 'An unexpected error occurred while processing your message.' };
  }
}
