'use server';

/**
 * @fileOverview A service for interacting with Google Drive.
 *
 * - getKnowledgeBase - Fetches and consolidates the content of all text files from a specified Google Drive folder.
 */

import {GaxiosResponse} from 'gaxios';
import {google} from 'googleapis';
import type {drive_v3} from 'googleapis/build/src/apis/drive/v3';
import {Readable} from 'stream';

function getGoogleDriveService() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    const missingVars = [];
    if (!privateKey) missingVars.push('GOOGLE_PRIVATE_KEY');
    if (!clientEmail) missingVars.push('GOOGLE_CLIENT_EMAIL');
    const errorMessage = `The following Google Drive environment variables are not configured: ${missingVars.join(
      ', '
    )}. Please set them in your .env file and restart the development server.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      private_key: privateKey,
      client_email: clientEmail,
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({version: 'v3', auth});
}

async function listFiles(
  drive: drive_v3.Drive,
  folderId: string
): Promise<drive_v3.Schema$File[]> {
  try {
    console.log(`Listing files from Google Drive folder: ${folderId}`);
    const query = `'${folderId}' in parents and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document') and trashed=false`;
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType)',
      pageSize: 100,
    });
    const files = res.data.files || [];
    console.log(`Found ${files.length} text files or Google Docs.`);
    return files;
  } catch (error) {
    console.error('Error listing files from Google Drive:', error);
    throw new Error('Failed to list files from Google Drive.');
  }
}

async function getFileContent(
  drive: drive_v3.Drive,
  fileId: string,
  mimeType: string
): Promise<string> {
  try {
    console.log(`Fetching content for file ID: ${fileId} (MIME type: ${mimeType})`);
    
    let res: GaxiosResponse<Readable>;
    if (mimeType === 'application/vnd.google-apps.document') {
      res = await drive.files.export(
        { fileId, mimeType: 'text/plain' },
        { responseType: 'stream' }
      );
    } else {
      res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
    }

    return new Promise((resolve, reject) => {
      let content = '';
      res.data
        .on('data', chunk => (content += chunk))
        .on('end', () => {
          console.log(`Successfully streamed content for file ID: ${fileId}`);
          resolve(content);
        })
        .on('error', err => {
          console.error(`Error streaming content for file ${fileId}:`, err);
          reject(new Error(`Failed to read content of file ${fileId}.`));
        });
    });
  } catch (error) {
    console.error(`Error getting content for file ${fileId}:`, error);
    throw new Error(`Failed to get content for file ${fileId}.`);
  }
}

/**
 * Fetches all .txt files from the specified Google Drive folder,
 * reads their content, and returns it as a single string.
 * @returns {Promise<string>} A promise that resolves to the combined content of all knowledge base files.
 */
export async function getKnowledgeBase(): Promise<string> {
  console.log('Fetching knowledge base from Google Drive...');
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    const errorMessage = `The GOOGLE_DRIVE_FOLDER_ID environment variable is not configured. Please set it in your .env file and restart the development server.`;
    console.error(errorMessage);
    return `Error: ${errorMessage}`;
  }

  try {
    const drive = getGoogleDriveService();
    const files = await listFiles(drive, folderId);

    if (files.length === 0) {
      console.log('No text files or Google Docs found in the specified Google Drive folder.');
      return 'I am sorry, I cannot answer this question based on the provided Google Drive data, as no relevant documents were found.';
    }

    const fileContents = await Promise.all(
      files.map(async file => {
        if (file.id && file.name && file.mimeType) {
          const content = await getFileContent(drive, file.id, file.mimeType);
          return `Document: ${file.name}\nContent:\n${content}\n---`;
        }
        return '';
      })
    );

    console.log(`Successfully fetched ${files.length} knowledge base files.`);
    return fileContents.join('\n');
  } catch (error) {
    console.error('An error occurred while building the knowledge base:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return `Error: Could not load knowledge base from Google Drive. Details: ${errorMessage}`;
  }
}
