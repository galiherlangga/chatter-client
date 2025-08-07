"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTicketCreation } from "@/hooks/use-ticket-creation";

interface TicketFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  messageId: string;
  onTicketCreated: (messageId: string, ticketId: string) => void;
}

export function TicketFormModal({
  isOpen,
  onClose,
  question,
  messageId,
  onTicketCreated,
}: TicketFormModalProps) {
  const [email, setEmail] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");

  const { createTicket, isCreating } = useTicketCreation({
    onSuccess: (ticketId) => {
      onTicketCreated(messageId, ticketId);
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Build complete question with additional details
      const fullQuestion = additionalDetails
        ? `${question}\n\nAdditional details: ${additionalDetails}`
        : question;

      // Create ticket with the complete question and user email
      await createTicket(fullQuestion, email);
    } catch (error) {
      console.error("Error creating ticket:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create a Ticket</DialogTitle>
          <DialogDescription>
            Please provide additional information to help us address your query.
          </DialogDescription>
          <Button
            className="absolute top-2 right-2 h-8 w-8 p-0"
            variant="ghost"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="question">Question</Label>
              <Textarea
                id="question"
                value={question}
                readOnly
                className="resize-none bg-muted"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">
                Email (optional)
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                We'll use this to notify you when we have an answer.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="details">
                Additional Details (optional)
              </Label>
              <Textarea
                id="details"
                placeholder="Add any additional information that might help us understand your question better."
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  Creating...
                </>
              ) : (
                "Create Ticket"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
