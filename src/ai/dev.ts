import { config } from 'dotenv';
config();

import '@/ai/flows/moderate-chat-content.ts';
import '@/ai/flows/generate-response-from-drive.ts';