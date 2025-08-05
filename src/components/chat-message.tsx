"use client";

import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: {
    url: string;
    alt?: string;
    needsDirectUrl?: boolean;
  }[];
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex items-start gap-4 animate-in fade-in zoom-in-95",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <Avatar className="w-8 h-8 border">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[75%] p-3 rounded-2xl shadow-sm space-y-2",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-card border rounded-bl-none",
        )}
      >
        <div className="text-sm prose prose-sm max-w-none text-current prose-p:my-0 prose-ul:my-2 prose-ol:my-2">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.images && message.images.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="text-xs text-muted-foreground font-medium">
              Related images:
            </div>
            <div
              className={`grid ${message.images.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-3`}
            >
              {message.images.map((image, index) => (
                <div
                  key={index}
                  className="rounded-md overflow-hidden border border-muted bg-white shadow-sm"
                >
                  <div className="relative pb-[70%]">
                    <img
                      src={image.url}
                      alt={image.alt || `Image ${index + 1}`}
                      className="absolute inset-0 w-full h-full object-contain p-1"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      loading="lazy"
                      decoding="async"
                      style={{
                        backgroundColor: "white",
                        maxWidth: "100%",
                        maxHeight: "100%",
                      }}
                      onError={(e) => {
                        console.log("Failed to load image:", image.url);

                        // Handle different Google Drive URL formats
                        // Try an alternative format for Google Drive URLs
                        const imgUrl = image.url;

                        // Check if this is already a googleusercontent URL (which should work directly)
                        if (imgUrl.includes("googleusercontent.com")) {
                          console.log(
                            "Already using googleusercontent URL, trying to fix CORS issues",
                          );
                          // For googleusercontent URLs, try adding a cache-busting parameter
                          const cacheBuster = Date.now();
                          const newUrl = imgUrl.includes("?")
                            ? `${imgUrl}&cb=${cacheBuster}`
                            : `${imgUrl}?cb=${cacheBuster}`;

                          // Also update style attributes that might help with display
                          e.currentTarget.style.backgroundColor = "white";
                          e.currentTarget.style.objectFit = "contain";
                          e.currentTarget.src = newUrl;
                          return;
                        }

                        // Try an alternative format for Google Drive URLs
                        if (imgUrl.includes("drive.google.com")) {
                          const idMatch = imgUrl.match(/id=([^&]+)/);
                          if (idMatch && idMatch[1]) {
                            const fileId = idMatch[1];
                            // Use direct public link format
                            const newUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                            console.log(
                              "Retrying with alternative URL format:",
                              newUrl,
                            );
                            e.currentTarget.src = newUrl;
                            return;
                          }

                          // Try to extract ID from other URL formats
                          const fileIdMatch = imgUrl.match(/\/d\/([^/]+)/);
                          if (fileIdMatch && fileIdMatch[1]) {
                            const fileId = fileIdMatch[1];
                            // Try using Google Drive viewer
                            const newUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                            console.log(
                              "Retrying with extracted file ID:",
                              newUrl,
                            );
                            e.currentTarget.src = newUrl;
                            return;
                          }
                        }

                        // Create iframe method as last resort
                        if (imgUrl.includes("drive.google.com")) {
                          const idMatch =
                            imgUrl.match(/id=([^&]+)/) ||
                            imgUrl.match(/\/d\/([^/]+)/);
                          if (idMatch && idMatch[1]) {
                            const fileId = idMatch[1];
                            // Replace the image with an iframe for preview
                            const parentNode = e.currentTarget.parentNode;
                            if (parentNode) {
                              const iframe = document.createElement("iframe");
                              iframe.src = `https://drive.google.com/file/d/${fileId}/preview`;
                              iframe.width = "100%";
                              iframe.height = "100%";
                              iframe.style.position = "absolute";
                              iframe.style.inset = "0";
                              iframe.style.border = "none";
                              iframe.frameBorder = "0";
                              iframe.allow = "autoplay";
                              iframe.allowFullscreen = true;
                              parentNode.innerHTML = "";
                              parentNode.appendChild(iframe);
                              console.log("Replaced with iframe preview");
                              return;
                            }
                          }
                        }

                        // Final fallback to placeholder
                        console.log(
                          "All image loading attempts failed, using placeholder",
                        );
                        e.currentTarget.src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                        e.currentTarget.style.padding = "2rem";
                        e.currentTarget.style.backgroundColor = "#f9f9f9";
                      }}
                      onLoad={(e) => {
                        console.log("Image loaded successfully:", image.url);
                        // Ensure proper styling for loaded images
                        e.currentTarget.style.maxWidth = "100%";
                        e.currentTarget.style.maxHeight = "100%";
                        e.currentTarget.style.objectFit = "contain";
                      }}
                    />
                  </div>
                  {image.alt && (
                    <div className="px-2 py-1 text-xs text-center text-muted-foreground truncate">
                      {image.alt}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {isUser && (
        <Avatar className="w-8 h-8 border">
          <AvatarFallback>
            <User className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
