"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { Send } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { handleSendMessage } from "@/app/actions";
import { ChatMessage, type Message } from "./chat-message";
import { LoadingIndicator } from "./loading-indicator";
import { useCallback } from "react";
import { TicketFormModal } from "./ticket-form-modal";

export default function ChatLayout() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I am ChroBot. How can I help you today? I can use images from my knowledge base to help answer your questions. If I don't have an answer in my knowledge base, I can create a ticket for our team to follow up.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketQuestion, setTicketQuestion] = useState("");
  const [ticketMessageId, setTicketMessageId] = useState("");

  // Function to attempt to get direct image URLs
  const tryGetDirectImageUrls = async (
    fileId: string,
  ): Promise<string | null> => {
    try {
      // Call our API endpoint to get the direct URL
      const response = await fetch("/api/image-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get image URL: ${response.statusText}`);
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Failed to get direct image URL:", error);
      return null;
    }
  };

  // Effect to handle scrolling
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Event handlers for ticket creation
  const handleCreateTicket = useCallback(
    (event: CustomEvent) => {
      const { messageId } = event.detail;

      // Get the user's question from the messages
      const userQuestion =
        messages.find((msg) => msg.id === messageId)?.content ||
        "Unknown question";

      // Open the ticket modal with this question
      setTicketQuestion(userQuestion);
      setTicketMessageId(messageId);
      setTicketModalOpen(true);
    },
    [messages],
  );

  // Handle ticket created from the modal
  const handleTicketCreated = useCallback(
    (messageId: string, ticketId: string) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                ticketCreated: true,
                suggestTicket: false,
                ticketCreationInProgress: false,
                ticketId: ticketId,
              }
            : msg,
        ),
      );
    },
    [],
  );

  const handleDismissTicket = useCallback((event: CustomEvent) => {
    const { messageId } = event.detail;
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, suggestTicket: false } : msg,
      ),
    );
  }, []);

  // Add event listeners for ticket actions
  useEffect(() => {
    window.addEventListener(
      "createTicket",
      handleCreateTicket as EventListener,
    );
    window.addEventListener(
      "dismissTicket",
      handleDismissTicket as EventListener,
    );

    return () => {
      window.removeEventListener(
        "createTicket",
        handleCreateTicket as EventListener,
      );
      window.removeEventListener(
        "dismissTicket",
        handleDismissTicket as EventListener,
      );
    };
  }, [handleCreateTicket, handleDismissTicket]);

  // Effect to try to get direct image URLs
  useEffect(() => {
    const processImages = async () => {
      let needsUpdate = false;
      const updatedMessages = [...messages];

      for (let i = 0; i < updatedMessages.length; i++) {
        const message = updatedMessages[i];
        if (message.images) {
          for (let j = 0; j < message.images.length; j++) {
            const image = message.images[j];
            if (image.needsDirectUrl) {
              // Extract the file ID from the Google Drive URL
              const idMatch =
                image.url.match(/id=([^&]+)/) ||
                image.url.match(/\/d\/([^/]+)/);
              if (idMatch && idMatch[1]) {
                const fileId = idMatch[1];
                console.log(`Fetching direct URL for file ID: ${fileId}`);
                const directUrl = await tryGetDirectImageUrls(fileId);
                if (directUrl) {
                  console.log(`Got direct URL: ${directUrl}`);
                  updatedMessages[i].images![j] = {
                    ...image,
                    url: directUrl,
                    needsDirectUrl: false,
                  };
                  needsUpdate = true;
                }
              }
            }
          }
        }
      }

      if (needsUpdate) {
        setMessages(updatedMessages);
      }
    };

    processImages();
  }, [messages]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageId = crypto.randomUUID();
    const userMessage: Message = {
      id: userMessageId,
      role: "user",
      content: input,
      // Users don't have images
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const result = await handleSendMessage(currentInput);

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error,
        });
        setMessages((prev) => prev.filter((msg) => msg.id !== userMessageId));
      } else if (result.response) {
        if (result.response) {
          // Convert image URLs if needed
          let processedImages = result.images;
          if (result.images && result.images.length > 0) {
            processedImages = result.images.map((image) => {
              // If URL is a Google Drive link, try to get the actual googleusercontent URL
              if (
                image.url.includes("drive.google.com") &&
                !image.url.includes("googleusercontent.com")
              ) {
                console.log(
                  `Setting up image for direct URL fetch: ${image.url}`,
                );
                // Keep the original URL but set a flag to try to fetch the direct URL
                return {
                  ...image,
                  needsDirectUrl: true,
                };
              }
              return image;
            });
          }

          const botMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.response || "",
            images: processedImages,
            suggestTicket: result.suggestTicket,
          };

          // Log message content for debugging
          console.log(
            "Adding bot message with images:",
            processedImages?.length || 0,
          );
          setMessages((prev) => [...prev, botMessage]);
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "An error occurred",
        description: "Failed to get a response. Please try again.",
      });
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl rounded-2xl">
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="ChroBot Logo"
              width={64}
              height={32}
            />
            <CardTitle className="font-headline text-2xl text-primary">
              ChroBot
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && <LoadingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="p-4 border-t bg-card/80">
          <form
            onSubmit={handleSubmit}
            className="flex w-full items-start gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 resize-none rounded-xl"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
                }
              }}
              disabled={isLoading}
              aria-label="Chat message input"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="bg-accent hover:bg-accent/90 rounded-full h-10 w-10 shrink-0"
            >
              <Send className="h-5 w-5 text-accent-foreground" />
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </CardFooter>
      </Card>

      {/* Ticket form modal */}
      <TicketFormModal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        question={ticketQuestion}
        messageId={ticketMessageId}
        onTicketCreated={handleTicketCreated}
      />
    </div>
  );
}
