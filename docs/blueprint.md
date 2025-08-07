# **App Name**: ChatterClient

## Core Features:

- Chat Display: Display a real-time chat interface with messages organized in a chronological order.
- Message Input: Allow users to type and send messages in real-time.
- Real-time Communication: Implement WebSocket communication to send and receive messages.
- Content Moderation: Utilize a tool to monitor chat content for harmful speech and provide feedback, warnings, or moderation actions.
- Google Drive Data Integration: Incorporate data from Google Drive as the base knowledge for the chat's responses.
- Knowledge Site: Is a list of sites used to provide additional context and information for the chat, enhancing the conversation quality.
- Response Generation: Add related images found in the Google Drive or knowledge sites to the chat responses, enriching the user experience.
- Images found in google drive or knowledge sites should be displayed in the chat responses to enhance the conversation quality. Load the images asynchronously to ensure smooth performance. In google drive it stored inside images dir, and category directories (e.g. login-step)

## Google Drive Scafolding:
- / (*.docx/*.xlsx/*.pdf) -> all document files that can be used as knowledge sources.
- /images/
-- /images/login-step/ -> images related to the login step.

## Style Guidelines:

- Primary color: Vivid blue (#558BFF) to invoke feelings of connection and trust.
- Background color: Light, desaturated blue (#E0E8FF) for a calming and clean backdrop.
- Accent color: Bright green (#7CFC00) to draw attention to interactive elements and highlight new messages.
- Font: 'Inter', a grotesque-style sans-serif with a modern, machined, objective, neutral look; suitable for headlines and body text.
- Use minimalist, clear icons for common actions like sending messages, adding attachments, and muting notifications.
- Employ a clean and intuitive layout with a clear separation between the message input area, the chat display, and user controls.
- Incorporate subtle animations for new message notifications and message delivery confirmations to enhance user engagement.