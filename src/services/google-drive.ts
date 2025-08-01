'use server';

/**
 * @fileOverview A service for interacting with Google Drive.
 *
 * - getKnowledgeBase - Fetches and consolidates the content of all text files and images from a specified Google Drive folder and its sub-folders.
 */

import {GaxiosResponse} from 'gaxios';
import {google} from 'googleapis';
import type {drive_v3} from 'googleapis/build/src/apis/drive/v3';
import {Readable} from 'stream';

// Interface for the structured knowledge base
export interface KnowledgeBase {
  documents: string;
  images: Record<string, drive_v3.Schema$File[]>;
}

function getGoogleDriveService() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error(
      'Google Drive credentials (GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL) are not configured.'
    );
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

async function listFilesAndFolders(
  drive: drive_v3.Drive,
  folderId: string
): Promise<drive_v3.Schema$File[]> {
  try {
    console.log(`Listing all items from Google Drive folder: ${folderId}`);
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, webViewLink, thumbnailLink)',
      pageSize: 200, // Increased page size
    });
    const items = res.data.files || [];
    console.log(`Found ${items.length} items (files and folders).`);
    return items;
  } catch (error) {
    console.error('Error listing files and folders:', error);
    throw new Error('Failed to list items from Google Drive.');
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
 * Fetches all documents and images from the specified Google Drive folder,
 * organizing them into a structured knowledge base.
 * @returns {Promise<KnowledgeBase | string>} A promise that resolves to the knowledge base object or an error string.
 */
export async function getKnowledgeBase(): Promise<KnowledgeBase | string> {
  console.log('Fetching knowledge base from Google Drive...');
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    const errorMessage = `The GOOGLE_DRIVE_FOLDER_ID environment variable is not configured. Please set it in your .env file and restart the development server.`;
    console.error(errorMessage);
    return `Error: ${errorMessage}`;
  }

  try {
    const drive = getGoogleDriveService();
    const allItems = await listFilesAndFolders(drive, folderId);

    const documents = allItems.filter(
      (item) =>
        item.mimeType === 'text/plain' ||
        item.mimeType === 'application/vnd.google-apps.document'
    );
    
    const folders = allItems.filter(
      (item) => item.mimeType === 'application/vnd.google-apps.folder'
    );

    if (documents.length === 0) {
      console.log('No text files or Google Docs found in the root of the specified Google Drive folder.');
      return 'I am sorry, I cannot answer this question based on the provided Google Drive data, as no relevant documents were found.';
    }

    // Fetch document contents
    const docContents = await Promise.all(
      documents.map(async (doc) => {
        if (doc.id && doc.name && doc.mimeType) {
          const content = await getFileContent(drive, doc.id, doc.mimeType);
          return `Document: ${doc.name}\nContent:\n${content}\n---`;
        }
        return '';
      })
    );

    // Fetch images from sub-folders
    const imageMap: Record<string, drive_v3.Schema$File[]> = {};
    for (const folder of folders) {
      if (folder.id && folder.name) {
        console.log(`Fetching images from sub-folder: ${folder.name}`);
        const imageFiles = await drive.files.list({
          q: `'${folder.id}' in parents and (mimeType='image/jpeg' or mimeType='image/png') and trashed=false`,
          fields: 'files(id, name, webViewLink, thumbnailLink)',
          pageSize: 50,
        });
        if (imageFiles.data.files && imageFiles.data.files.length > 0) {
          imageMap[folder.name] = imageFiles.data.files;
          console.log(`Found ${imageFiles.data.files.length} images in ${folder.name}.`);
        }
      }
    }
    
    console.log(`Successfully fetched ${documents.length} documents.`);
    if (Object.keys(imageMap).length > 0) {
      console.log(`Successfully mapped images from ${Object.keys(imageMap).length} sub-folders.`);
    }

    return {
      documents: docContents.join('\n'),
      images: imageMap,
    };
  } catch (error) {
    console.error('An error occurred while building the knowledge base:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return `Error: Could not load knowledge base from Google Drive. Details: ${errorMessage}`;
  }
}