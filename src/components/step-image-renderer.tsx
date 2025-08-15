"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

export interface MessageImage {
  url: string;
  alt?: string;
  needsDirectUrl?: boolean;
  stepId?: string; // Optional identifier for associating images with specific steps
}

interface StepImageRendererProps {
  content: string;
  images?: MessageImage[];
}

// Helper function to render an individual image
const ImageComponent = ({
  image,
  index,
}: {
  image: MessageImage;
  index: any;
}) => {
  return (
    <div
      key={index}
      className="rounded-md overflow-hidden border border-muted bg-white shadow-sm"
    >
      <div className="relative pb-[70%]">
        <img
          src={image.url}
          alt={image.alt || `Image ${index + 1}`}
          className="absolute inset-0 w-full h-full object-contain p-1"
          loading="lazy"
          decoding="async"
          style={{
            backgroundColor: "white",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
          onError={(e) => {
            console.log("Failed to load proxied image:", image.url);
            e.currentTarget.src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
            e.currentTarget.style.padding = "2rem";
            e.currentTarget.style.backgroundColor = "#f9f9f9";
          }}
          onLoad={(e) => {
            console.log("Image loaded successfully:", image.url);
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
  );
};

export const StepImageRenderer: React.FC<StepImageRendererProps> = ({
  content,
  images = [],
}) => {
  // Process content to inject images directly at the right positions
  const processedContent = React.useMemo(() => {
    if (images.length === 0) return content;

    console.log("Processing content with images:", {
      totalImages: images.length,
      stepIds: images.map((img) => img.stepId).filter(Boolean),
    });

    // Split content into lines
    const lines = content.split("\n");
    const processedLines: string[] = [];
    let stepCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      processedLines.push(line);

      // Check if this line starts a numbered list item
      const listItemMatch = line.match(/^(\d+)\.\s+/);
      if (listItemMatch) {
        const stepId = `step-${stepCounter}`;
        const matchingImages = images.filter((img) => img.stepId === stepId);

        if (matchingImages.length > 0) {
          console.log(
            `Injecting ${matchingImages.length} images after step ${stepCounter}`,
          );

          // Add images as markdown after this step
          matchingImages.forEach((img) => {
            processedLines.push("");
            processedLines.push(`<div class="mt-2 mb-4 ml-6">`);
            processedLines.push(`<div class="grid grid-cols-1 gap-3">`);
            processedLines.push(
              `<div class="rounded-md overflow-hidden border border-muted bg-white shadow-sm">`,
            );
            processedLines.push(`<div class="relative pb-[70%]">`);
            processedLines.push(
              `<img src="${img.url}" alt="${img.alt || `Step ${stepCounter} image`}" class="absolute inset-0 w-full h-full object-contain p-1" loading="lazy" style="background-color: white; max-width: 100%; max-height: 100%;" />`,
            );
            processedLines.push(`</div>`);
            if (img.alt) {
              processedLines.push(
                `<div class="px-2 py-1 text-xs text-center text-muted-foreground truncate">${img.alt}</div>`,
              );
            }
            processedLines.push(`</div>`);
            processedLines.push(`</div>`);
            processedLines.push(`</div>`);
          });
        }
        stepCounter++;
      }
    }

    return processedLines.join("\n");
  }, [content, images]);

  return (
    <>
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        components={{
          // Allow HTML elements to render
          div: ({ node, ...props }) => <div {...props} />,
          img: ({ node, ...props }) => <img {...props} />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </>
  );
};
