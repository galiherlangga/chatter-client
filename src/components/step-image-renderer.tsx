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
            // Since this is a proxied URL, we can't do much on error.
            // We'll just show a placeholder.
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
  );
};

export const StepImageRenderer: React.FC<StepImageRendererProps> = ({
  content,
  images = [],
}) => {
  if (!images || images.length === 0) {
    return <ReactMarkdown>{content}</ReactMarkdown>;
  }

  // Parse the content to identify steps and sections
  // Check if the content has numbered steps or bullet points
  const hasNumberedSteps = /^\d+\.\s/gm.test(content);
  const hasBulletPoints = /^[-*]\s/gm.test(content);

  if (!hasNumberedSteps && !hasBulletPoints) {
    // If no steps are found, just show content followed by all images
    return (
      <>
        <ReactMarkdown>{content}</ReactMarkdown>
        <div className="mt-4 space-y-3">
          <div className="text-xs text-muted-foreground font-medium">
            Related images:
          </div>
          <div
            className={`grid ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-3`}
          >
            {images.map((image, index) => (
              <ImageComponent key={index} image={image} index={index} />
            ))}
          </div>
        </div>
      </>
    );
  }

  // Split content into sections by steps
  let sections: string[] = [];

  if (hasNumberedSteps) {
    // Split by numbered steps (1. Step one, 2. Step two, etc.)
    sections = content.split(/(?=^\d+\.\s)/gm);
  } else if (hasBulletPoints) {
    // Split by bullet points
    sections = content.split(/(?=^[-*]\s)/gm);
  }

  // Filter out empty sections
  sections = sections.filter((section) => section.trim().length > 0);

  // Helper function to find images for a step
  const findImagesForStep = (stepText: string, stepIndex: number) => {
    // Look for image references in step text
    const lowerStepText = stepText.toLowerCase();

    // Keywords that might appear in step text and image names
    const stepNumber = (stepIndex + 1).toString();
    const stepKeywords = [
      `step ${stepNumber}`,
      `step${stepNumber}`,
      `step-${stepNumber}`,
      `${stepNumber}.`,
      `image ${stepNumber}`,
      `screenshot ${stepNumber}`,
    ];

    // Find images with matching step numbers or keywords
    return images.filter((image) => {
      const imageName = (image.alt || "").toLowerCase();
      const imageUrl = image.url.toLowerCase();

      // Check for step number in image name or URL
      const matchesStepNumber = stepKeywords.some(
        (keyword) => imageName.includes(keyword) || imageUrl.includes(keyword),
      );

      // Check for explicit stepId match
      const matchesStepId = image.stepId === `step-${stepIndex + 1}`;

      // Check for keyword matches between step text and image name/alt
      const wordsInStep = lowerStepText
        .split(/\W+/)
        .filter((word) => word.length > 3);

      const wordsInImage = imageName
        .split(/\W+/)
        .filter((word) => word.length > 3);

      const hasMatchingKeywords = wordsInStep.some((stepWord) =>
        wordsInImage.some(
          (imgWord) => imgWord.includes(stepWord) || stepWord.includes(imgWord),
        ),
      );

      return matchesStepNumber || matchesStepId || hasMatchingKeywords;
    });
  };

  // Render each section with its associated images
  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        const stepImages = findImagesForStep(section, index);
        const hasImages = stepImages.length > 0;

        return (
          <div key={`step-${index}`} className="space-y-2">
            <ReactMarkdown>{section}</ReactMarkdown>

            {hasImages && (
              <div className="mt-2 mb-4">
                <div
                  className={`grid ${stepImages.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-3`}
                >
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
          </div>
        );
      })}

      {/* Show remaining images that weren't associated with specific steps */}
      {(() => {
        const usedImages = sections.flatMap((section, index) =>
          findImagesForStep(section, index),
        );

        const unusedImages = images.filter(
          (image) => !usedImages.some((usedImg) => usedImg.url === image.url),
        );

        if (unusedImages.length > 0) {
          return (
            <div className="mt-4 space-y-3">
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
    </div>
  );
};
