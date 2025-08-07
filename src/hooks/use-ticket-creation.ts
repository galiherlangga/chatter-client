"use client";

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Ticket {
  id: string;
  question: string;
  createdAt: string;
  status: 'pending' | 'in_progress' | 'resolved';
}

interface UseTicketCreationProps {
  onSuccess?: (ticketId: string) => void;
  onError?: (error: Error) => void;
}

export function useTicketCreation({ onSuccess, onError }: UseTicketCreationProps = {}) {
  const [isCreating, setIsCreating] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const createTicket = useCallback(async (question: string, userEmail?: string) => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/create-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          userEmail: userEmail || "",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create ticket");
      }

      const newTicket: Ticket = {
        id: result.ticketId,
        question,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };

      setTicket(newTicket);

      toast({
        title: "Ticket Created",
        description: `Ticket #${result.ticketId} has been created. Our team will look into your question.`,
      });

      if (onSuccess) {
        onSuccess(result.ticketId);
      }

      return result.ticketId;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error creating ticket");
      setError(err);

      toast({
        variant: "destructive",
        title: "Failed to Create Ticket",
        description: "There was an error creating your ticket. Please try again.",
      });

      if (onError) {
        onError(err);
      }

      throw err;
    } finally {
      setIsCreating(false);
    }
  }, [toast, onSuccess, onError]);

  const resetTicket = useCallback(() => {
    setTicket(null);
    setError(null);
  }, []);

  return {
    createTicket,
    isCreating,
    ticket,
    error,
    resetTicket,
  };
}
