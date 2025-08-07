"use server";

/**
 * @fileOverview A service for interacting with Google Drive.
 *
 * - getKnowledgeBase - Fetches and consolidates the content of all text files from a specified Google Drive folder.
 * - getImagesFromKnowledgeSites - Fetches images from knowledge sites in Google Drive and retrieves their direct download URLs.
 * - getCachedImageUrls - Retrieves cached direct image URLs from localStorage.
 * - cacheImageUrls - Stores direct image URLs in localStorage for future use.
 */

import { GaxiosResponse } from "gaxios";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis/build/src/apis/drive/v3";
import { Readable } from "stream";

function getGoogleDriveService() {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

    if (!privateKey || !clientEmail) {
        throw new Error(
            "Google Drive credentials (GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL) are not configured.",
        );
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            private_key: privateKey,
            client_email: clientEmail,
        },
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    return google.drive({ version: "v3", auth });
}

async function listFiles(
    drive: drive_v3.Drive,
    folderId: string,
    mimeTypeQuery: string = `mimeType='text/plain' or mimeType='application/vnd.google-apps.document'`,
    recursive: boolean = false,
): Promise<drive_v3.Schema$File[]> {
    try {
        console.log(`Listing files from Google Drive folder: ${folderId}`);

        // For non-recursive queries, just search within the specified folder
        let query = `'${folderId}' in parents and (${mimeTypeQuery}) and trashed=false`;

        // For recursive queries, search across all accessible files
        if (recursive) {
            query = `(${mimeTypeQuery}) and trashed=false`;
        }

        const res = await drive.files.list({
            q: query,
            fields: "files(id, name, mimeType, webContentLink, thumbnailLink, parents)",
            pageSize: 1000, // Increased to handle larger folders and subfolders
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });

        const files = res.data.files || [];
        console.log(`Found ${files.length} files.`);

        // Log details about each file for debugging
        if (files.length > 0) {
            files.forEach((file) => {
                console.log(
                    `File: ${file.name}, ID: ${file.id}, Type: ${file.mimeType}`,
                );
                console.log(
                    `  Thumbnail: ${file.thumbnailLink || "Not available"}`,
                );
                console.log(
                    `  Web link: ${file.webContentLink || "Not available"}`,
                );
            });
        }

        return files;
    } catch (error) {
        console.error("Error listing files:", error);
        throw new Error("Failed to list files from Google Drive.");
    }
}

// Function to list all folders recursively starting from a root folder
async function listAllFolders(
    drive: drive_v3.Drive,
    rootFolderId: string,
): Promise<drive_v3.Schema$File[]> {
    try {
        console.log(`Listing all folders from root folder: ${rootFolderId}`);
        const res = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: "files(id, name, parents)",
            pageSize: 1000,
            // Ensure we get all folders with proper permissions
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });

        const folders = res.data.files || [];
        console.log(`Found ${folders.length} folders in total.`);
        return folders;
    } catch (error) {
        console.error("Error listing folders:", error);
        throw new Error("Failed to list folders from Google Drive.");
    }
}

async function getFileContent(
    drive: drive_v3.Drive,
    fileId: string,
    mimeType: string,
): Promise<string> {
    try {
        console.log(
            `Fetching content for file ID: ${fileId} (MIME type: ${mimeType})`,
        );

        let res: GaxiosResponse<Readable>;
        if (mimeType === "application/vnd.google-apps.document") {
            res = await drive.files.export(
                { fileId, mimeType: "text/plain" },
                { responseType: "stream" },
            );
        } else {
            res = await drive.files.get(
                { fileId, alt: "media" },
                { responseType: "stream" },
            );
        }

        return new Promise((resolve, reject) => {
            let content = "";
            res.data
                .on("data", (chunk) => (content += chunk))
                .on("end", () => {
                    console.log(
                        `Successfully streamed content for file ID: ${fileId}`,
                    );
                    resolve(content);
                })
                .on("error", (err) => {
                    console.error(
                        `Error streaming content for file ${fileId}:`,
                        err,
                    );
                    reject(
                        new Error(`Failed to read content of file ${fileId}.`),
                    );
                });
        });
    } catch (error) {
        console.error(`Error getting content for file ${fileId}:`, error);
        throw new Error(`Failed to get content for file ${fileId}.`);
    }
}

/**
 * Fetches all documents from the specified Google Drive folder and consolidates their content.
 * @returns {Promise<string>} A promise that resolves to the consolidated document content or an error string.
 */
export async function getKnowledgeBase(): Promise<string> {
    console.log("Fetching knowledge base from Google Drive...");
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
            console.log(
                "No text files or Google Docs found in the specified Google Drive folder.",
            );
            return "I am sorry, I cannot answer this question based on the provided Google Drive data, as no relevant documents were found.";
        }

        const docContents = await Promise.all(
            files.map(async (file) => {
                if (file.id && file.name && file.mimeType) {
                    const content = await getFileContent(
                        drive,
                        file.id,
                        file.mimeType,
                    );
                    return `Document: ${file.name}\nContent:\n${content}\n---`;
                }
                return "";
            }),
        );

        console.log(
            `Successfully fetched and consolidated ${files.length} documents.`,
        );
        return docContents.join("\n");
    } catch (error) {
        console.error(
            "An error occurred while building the knowledge base:",
            error,
        );
        const errorMessage =
            error instanceof Error
                ? error.message
                : "An unknown error occurred.";
        return `Error: Could not load knowledge base from Google Drive. Details: ${errorMessage}`;
    }
}

/**
 * A type representing an image from Google Drive
 */
export interface DriveImage {
    id: string;
    name: string;
    contentLink: string;
    directLink?: string; // Direct lh3.googleusercontent.com link when available
}

/**
 * Cache key for storing direct image URLs in localStorage
 */
const IMAGE_URL_CACHE_KEY = "drive_image_direct_urls";

/**
 * Retrieves cached direct image URLs from localStorage
 * @returns Record mapping file IDs to direct URLs
 */
export async function getCachedImageUrls(): Promise<Record<string, string>> {
    try {
        // Since this is a server component, we can't directly access localStorage
        // In a real implementation, you would use a database or other server-side storage
        // For simplicity, we're returning an empty object here
        return {};
    } catch (error) {
        console.error("Error retrieving cached image URLs:", error);
        return {};
    }
}

/**
 * Stores direct image URLs in localStorage for future use
 * @param urls Record mapping file IDs to direct URLs
 */
export async function cacheImageUrls(
    urls: Record<string, string>,
): Promise<void> {
    try {
        // Since this is a server component, we can't directly access localStorage
        // In a real implementation, you would use a database or other server-side storage
        console.log("Would cache the following URLs:", urls);
    } catch (error) {
        console.error("Error caching image URLs:", error);
    }
}

/**
 * Fetches image files from the specified Google Drive folder.
 * @returns {Promise<DriveImage[]>} A promise that resolves to an array of image metadata or an empty array if there's an error.
 */
export async function getImagesFromKnowledgeSites(): Promise<DriveImage[]> {
    console.log("Fetching images from knowledge sites in Google Drive...");
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
        console.error(
            "The GOOGLE_DRIVE_FOLDER_ID environment variable is not configured.",
        );
        return [];
    }

    try {
        const drive = getGoogleDriveService();
        // Check if API service is properly authenticated
        try {
            const aboutResponse = await drive.about.get({
                fields: "user,storageQuota,maxImportSizes",
            });
            console.log(
                "Google Drive API is properly authenticated:",
                aboutResponse.data.user?.emailAddress || "Unknown user",
            );
            console.log("Google Drive API successfully connected");

            // Get web app URL - used for CORS configuration
            const appUrl =
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            console.log(`App URL for CORS: ${appUrl}`);
        } catch (authError) {
            console.error("Google Drive API authentication error:", authError);
            console.warn(
                "Check your Google Drive API credentials and permissions",
            );
        }

        const imageTypes = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/svg+xml",
            "image/webp",
            "image/jpg",
            "image/bmp",
            "application/vnd.google-apps.photo",
            "application/vnd.google-apps.drawing",
        ];
        const mimeTypeQuery = imageTypes
            .map((type) => `mimeType='${type}'`)
            .join(" or ");

        console.log("Looking for images in all folders and subfolders...");

        // Get all folders including subfolders
        const allFolders = await listAllFolders(drive, folderId);

        // Always include the root folder
        const folderIds = [folderId];

        // Find all folders that are descendants of our root folder
        const findChildFolders = (parentId: string): string[] => {
            const childFolders = allFolders.filter(
                (folder) => folder.parents && folder.parents.includes(parentId),
            );
            let results = childFolders.map((f) => f.id as string);

            // Recursively add children of children
            childFolders.forEach((folder) => {
                if (folder.id) {
                    results = results.concat(findChildFolders(folder.id));
                }
            });

            return results;
        };

        // Add all child folder IDs to our list
        folderIds.push(...findChildFolders(folderId));

        console.log(`Searching for images in ${folderIds.length} folders`);

        // Use recursive search to find all images
        console.log(`Listing files with query: ${mimeTypeQuery}`);
        const files = await listFiles(drive, folderId, mimeTypeQuery, true);

        // Filter files to only include those in our folder hierarchy
        const relevantFiles = files.filter(
            (file) =>
                file.parents &&
                folderIds.some((id) => file.parents.includes(id)),
        );

        console.log(`Found ${relevantFiles.length} image files in all folders`);

        if (relevantFiles.length === 0) {
            console.log("No image files found in any folders or subfolders.");
            return [];
        }

        // For each image file, create a publicly accessible URL
        const images = relevantFiles.map((file) => {
            // Get the folder path for better identification
            const folderName =
                file.parents && file.parents[0]
                    ? allFolders.find((f) => f.id === file.parents![0])?.name ||
                      ""
                    : "";

            // Format the display name to include folder context if available
            const displayName = folderName
                ? `${folderName}/${file.name}`
                : file.name || "";

            // Generate various URL formats for the image
            // 1. Standard public link format
            const standardLink = `https://drive.google.com/uc?export=view&id=${file.id}`;

            console.log(`Image: ${displayName}, ID: ${file.id}`);

            // For direct access links, we'll use the standard format initially
            // The actual direct lh3.googleusercontent.com links will be retrieved separately
            return {
                id: file.id || "",
                name: displayName, // Include folder context in name
                contentLink: standardLink
            };
        });

        if (images.length > 0) {
            console.log(
                `Successfully retrieved ${images.length} images from Google Drive`,
            );
        } else {
            console.warn(
                "No images found or accessible in the specified Google Drive folder",
            );
        }

        return images;
    } catch (error) {
        console.error("An error occurred while fetching images:", error);
        console.error(
            "Make sure your Google Drive folder contains image files and permissions are set correctly",
        );
        return [];
    }
}


/**
 * Retrieves the binary data of a single image file from Google Drive.
 * @param {string} fileId - The ID of the file to retrieve.
 * @returns {Promise<{ stream: Readable; contentType: string | null; }>} A promise that resolves to the image data stream and content type.
 */
export async function getImageData(fileId: string): Promise<{ stream: Readable | null; contentType: string | null; }> {
    try {
        console.log(`Fetching image data for file ID: ${fileId}`);
        const drive = getGoogleDriveService();

        // First, get file metadata to determine the MIME type
        const metaRes = await drive.files.get({
            fileId: fileId,
            fields: 'mimeType',
            supportsAllDrives: true,
        });
        const mimeType = metaRes.data.mimeType;
        
        console.log(`File ${fileId} has MIME type: ${mimeType}`);

        if (!mimeType || !mimeType.startsWith('image/')) {
            throw new Error(`File with ID ${fileId} is not a valid image.`);
        }

        // Get the file content as a readable stream
        const res = await drive.files.get(
            { fileId: fileId, alt: "media" },
            { responseType: "stream" },
        );

        return {
            stream: res.data,
            contentType: mimeType,
        };
    } catch (error) {
        console.error(`Error getting image data for file ${fileId}:`, error);
        // Don't re-throw, just return nulls so the caller can handle it gracefully
        return { stream: null, contentType: null };
    }
}
