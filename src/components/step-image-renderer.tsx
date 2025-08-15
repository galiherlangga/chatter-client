"use client";

import React from "react";
import ReactMarkdown from "react-markdown";

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
const ImageComponent = ({ image, index }: { image: MessageImage; index: any }) => {
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
  const usedImageUrls = new Set<string>();

  const CustomListItem = (props: any) => {
    const { node, ordered, index, children } = props;
    const stepNumber = ordered ? (node.position?.start.line || 0) : (index ?? 0) + 1;
    const currentStepId = `step-${stepNumber}`;
    const stepImages = images.filter((image) => image.stepId === currentStepId);

    // Mark images as used
    stepImages.forEach((img) => usedImageUrls.add(img.url));

    return (
      <li className="list-item">
        <div>{children}</div>
        {stepImages.length > 0 && (
          <div className="mt-2 mb-4 ml-6">
            <div className={`grid grid-cols-1 gap-3`}>
              {stepImages.map((image, imgIndex) => (
                <ImageComponent
                  key={`step-${index}-img-${imgIndex}`}
                  image={image}
                  index={`step-${index}-img-${imgIndex}`}
                />
              ))}
            </div>
          </div>
        )}
      </li>
    );
  };
  
  return (
    <>
      <ReactMarkdown
        components={{
          li: CustomListItem,
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Show remaining images that weren't associated with specific steps */}
      {(() => {
        const unusedImages = images.filter(
          (image) => !usedImageUrls.has(image.url)
        );

        if (unusedImages.length > 0) {
          return (
            <div className="mt-4 space-y-3 pt-4 border-t">
              <div className="text-xs text-muted-foreground font-medium">
                Additional related images:
              </div>
              <div
                className={`grid ${unusedImages.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-3`}
              >
                {unusedImages.map((image, index) => (
                  <ImageComponent
                    key={`unused-${index}`}
                    image={image}
                    index={`unused-${index}`}
                  />
                ))}
              </div>
            </div>
          );
        }
        return null;
      })()}
    </>
  );
};
