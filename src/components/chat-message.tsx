"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StepImageRenderer, MessageImage } from "./step-image-renderer";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: MessageImage[];
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
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
      >
        <div className="text-sm prose prose-sm max-w-none text-current prose-p:my-0 prose-ul:my-2 prose-ol:my-2">
          <StepImageRenderer
            content={message.content}
            images={message.images}
          />
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
