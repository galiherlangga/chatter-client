'use server';

import { moderateChatContent } from "@/ai/flows/moderate-chat-content";
import { generateResponseFromDrive } from "@/ai/flows/generate-response-from-drive";
import { getKnowledgeBase } from "@/services/google-drive";

export async function handleSendMessage(message: string): Promise<{ response?: string; error?: string }> {
  try {
    const moderationResult = await moderateChatContent({ text: message });

    if (moderationResult.isHarmful) {
      console.warn('Harmful content detected:', moderationResult);
      return { error: `Message flagged as harmful. ${moderationResult.feedback}` };
    }
    
    const driveData = await getKnowledgeBase();

    if (driveData.startsWith('Error:')) {
      console.error('Failed to get knowledge base from Google Drive:', driveData);
      return { error: `I am having trouble accessing the knowledge base from Google Drive. Please ensure it's configured correctly. Details: ${driveData}` };
    }

    const responseResult = await generateResponseFromDrive({
      query: message,
      driveData,
    });

    return { response: responseResult.response };

  } catch (e) {
    console.error(e);
    // Provide more specific error messages if possible
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
    return { error: `An unexpected error occurred while processing your message: ${errorMessage}` };
  }
}
