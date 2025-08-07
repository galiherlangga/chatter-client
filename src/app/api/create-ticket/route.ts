import { NextRequest, NextResponse } from "next/server";

/**
 * API endpoint to create a ticket for questions not found in the knowledge base
 *
 * This is a simple mock implementation. In a real application, this would:
 * 1. Connect to a ticketing system (like Zendesk, JIRA, etc.)
 * 2. Create a proper ticket with the user's question
 * 3. Associate the ticket with the user's account or session
 * 4. Return the ticket ID and link for reference
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, userEmail } = body;

    if (!question) {
      return NextResponse.json(
        { error: "Missing required field: question" },
        { status: 400 },
      );
    }

    // Log the ticket creation request
    console.log("Ticket creation request:");
    console.log(`Question: ${question}`);
    console.log(`User email: ${userEmail || "Anonymous"}`);

    // In a real implementation, we would create a ticket in a ticketing system
    // and return the ticket ID

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate a mock ticket ID
    const ticketId = `TICKET-${Date.now().toString().slice(-6)}`;

    return NextResponse.json({
      success: true,
      ticketId,
      message: "Ticket created successfully. Our team will review your question."
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 },
    );
  }
}
