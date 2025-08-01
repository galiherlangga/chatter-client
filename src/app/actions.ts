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
    
    const knowledgeBase = await getKnowledgeBase();

    // Check if the knowledge base returned an error string.
    if (knowledgeBase.startsWith('Error:')) {
      console.error('Failed to get knowledge base from Google Drive:', knowledgeBase);
      return { error: `I am having trouble accessing my knowledge base from Google Drive right now. Please ensure it's configured correctly and try again later.` };
    }

    // Check for the "no documents found" case.
    if (knowledgeBase === 'I am sorry, I cannot answer this question based on the provided Google Drive data, as no relevant documents were found.') {
      return { response: knowledgeBase };
    }

    const responseResult = await generateResponseFromDrive({
      query: message,
      driveData: knowledgeBase,
    });
    
    return { response: responseResult.response };

  } catch (e) {
    console.error(e);
    // Provide more specific error messages if possible
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
    return { error: `An unexpected error occurred while processing your message: ${errorMessage}` };
  }
}
