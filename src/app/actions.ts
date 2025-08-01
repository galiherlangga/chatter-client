'use server';

import { moderateChatContent } from "@/ai/flows/moderate-chat-content";
import { generateResponseFromDrive } from "@/ai/flows/generate-response-from-drive";
import { getKnowledgeBase, type KnowledgeBase } from "@/services/google-drive";

export async function handleSendMessage(message: string): Promise<{ response?: string; imageUrl?: string; error?: string }> {
  try {
    const moderationResult = await moderateChatContent({ text: message });

    if (moderationResult.isHarmful) {
      console.warn('Harmful content detected:', moderationResult);
      return { error: `Message flagged as harmful. ${moderationResult.feedback}` };
    }
    
    const knowledgeBase = await getKnowledgeBase();

    if (typeof knowledgeBase === 'string') {
      console.error('Failed to get knowledge base from Google Drive:', knowledgeBase);
      return { error: `I am having trouble accessing the knowledge base from Google Drive. Please ensure it's configured correctly. Details: ${knowledgeBase}` };
    }

    const { documents, images } = knowledgeBase;

    const responseResult = await generateResponseFromDrive({
      query: message,
      driveData: documents,
      availableImages: images,
    });
    
    // The thumbnailLink from Google Drive needs to be resized for better quality
    const imageUrl = responseResult.imageUrl ? `${responseResult.imageUrl.split('=')[0]}=s800` : undefined;

    return { response: responseResult.response, imageUrl };

  } catch (e) {
    console.error(e);
    // Provide more specific error messages if possible
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
    return { error: `An unexpected error occurred while processing your message: ${errorMessage}` };
  }
}