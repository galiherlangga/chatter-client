# ChatterClient

ChatterClient is an intelligent chat interface that provides responses based on a knowledge base stored in Google Drive. It features step-by-step guides with images, content moderation, and ticketing for unanswered questions.

## Features

### Core Features

- **Chat Interface**: Real-time chat interface with chronological message display.
- **Message Input**: Allows users to type and send messages.
- **Google Drive Integration**: Incorporates data from Google Drive as the knowledge base.
- **Knowledge Sites**: Uses additional context from specified sites to enhance responses.
- **Content Moderation**: Monitors chat content for harmful speech.
- **Step-by-Step Guides with Images**: Displays relevant images below each corresponding step in guides.
- **Ticketing System**: Offers to create support tickets when answers aren't found in the knowledge base.

### Technical Features

- **WebSocket Communication**: Real-time message exchange.
- **Responsive Design**: Works on mobile and desktop devices.
- **Image Handling**: Loads and displays images from Google Drive.
- **Step-Aware Image Display**: Intelligently associates images with specific steps.
- **Ticket Creation Form**: Collects additional information when creating support tickets.

## Project Structure

- `/src/app`: Main application pages and server actions
- `/src/ai`: AI flows for generating responses and content moderation
- `/src/components`: React components including chat UI
- `/src/hooks`: Custom React hooks
- `/src/lib`: Utility functions
- `/src/services`: API integrations like Google Drive

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Run the development server: `npm run dev`

## Environment Variables

- `GOOGLE_DRIVE_FOLDER_ID`: ID of the Google Drive folder containing knowledge base docs
- `GOOGLE_PRIVATE_KEY`: Service account private key for Google Drive access
- `GOOGLE_CLIENT_EMAIL`: Service account email for Google Drive access

## Google Drive Structure

The knowledge base is structured as follows:
- `/` - Document files (*.docx, *.xlsx, *.pdf) used as knowledge sources
- `/images/` - Images directory
  - `/images/login-step/` - Step-by-step login images

## Style Guidelines

- Primary color: Vivid blue (#558BFF)
- Background color: Light, desaturated blue (#E0E8FF)
- Accent color: Bright green (#7CFC00)
- Font: 'Inter'