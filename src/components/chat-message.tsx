"use client";

import { Bot, User, Ticket, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StepImageRenderer, MessageImage } from "./step-image-renderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: MessageImage[];
  suggestTicket?: boolean;
  ticketCreated?: boolean;
  ticketCreationInProgress?: boolean;
  ticketId?: string;
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  // Add a data attribute to help identify messages for ticket creation
  const messageProps = {
    "data-message-id": message.id,
  };
  return (
    <div
      className={cn(
        "flex items-start gap-4 animate-in fade-in zoom-in-95",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <Avatar className="w-8 h-8 border">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[75%] p-3 rounded-2xl shadow-sm space-y-2",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-card border rounded-bl-none",
        )}
        {...messageProps}
      >
        <div className="text-sm prose prose-sm max-w-none text-current prose-p:my-0 prose-ul:my-2 prose-ol:my-2">
          <StepImageRenderer
            content={message.content}
            images={message.images}
          />
          {message.suggestTicket &&
            !message.ticketCreated &&
            !message.ticketCreationInProgress && (
              <div className="mt-4 flex flex-col gap-2">
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-sm">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="text-amber-600 mt-0.5">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-amber-900 mb-1">
                        Not Found in Knowledge Base
                      </h4>
                      <p className="text-amber-800 mb-3">
                        I don't have information about this in my knowledge
                        base. Would you like to create a ticket so our team can
                        follow up?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white hover:bg-amber-100 text-amber-800 border-amber-300"
                          onClick={(e) => {
                            e.preventDefault();
                            // Find the parent message component
                            const messageElement =
                              e.currentTarget.closest("[data-message-id]");
                            if (messageElement) {
                              const messageId =
                                messageElement.getAttribute("data-message-id");
                              const event = new CustomEvent("createTicket", {
                                detail: { messageId },
                              });
                              window.dispatchEvent(event);
                            }
                          }}
                        >
                          <Ticket className="mr-1.5 h-4 w-4" />
                          Create Support Ticket
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hover:bg-amber-100 text-amber-700"
                          onClick={(e) => {
                            e.preventDefault();
                            // Find the parent message component
                            const messageElement =
                              e.currentTarget.closest("[data-message-id]");
                            if (messageElement) {
                              const messageId =
                                messageElement.getAttribute("data-message-id");
                              const event = new CustomEvent("dismissTicket", {
                                detail: { messageId },
                              });
                              window.dispatchEvent(event);
                            }
                          }}
                        >
                          <X className="mr-1 h-4 w-4" />
                          No Thanks
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          {message.ticketCreationInProgress && (
            <div className="mt-4 bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-200 text-sm flex items-center">
              <div className="animate-spin mr-3 h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <p>Creating support ticket...</p>
            </div>
          )}
          {message.ticketCreated && (
            <div className="mt-4 bg-green-50 p-4 rounded-lg border border-green-200 text-sm">
              <div className="flex items-start gap-3">
                <div className="text-green-600 mt-0.5">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-green-900">
                      Support Ticket Created
                    </h4>
                    {message.ticketId && (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 border-green-300"
                      >
                        #{message.ticketId}
                      </Badge>
                    )}
                  </div>
                  <p className="text-green-800">
                    Our team will review your question and follow up with you
                    soon.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {isUser && (
        <Avatar className="w-8 h-8 border">
          <AvatarFallback>
            <User className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
