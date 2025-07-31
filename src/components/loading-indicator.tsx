'use client';

import { Bot, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function LoadingIndicator() {
  return (
    <div className="flex items-start gap-4 justify-start animate-in fade-in zoom-in-95">
      <Avatar className="w-8 h-8 border">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <Bot className="w-5 h-5" />
        </AvatarFallback>
      </Avatar>
      <div className="max-w-[75%] p-3 rounded-2xl bg-card border rounded-bl-none shadow-sm">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Thinking...</p>
        </div>
      </div>
    </div>
  );
}
