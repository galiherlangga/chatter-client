import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import Image from "next/image";

export const metadata: Metadata = {
  title: "ChroBot",
  description: "A real-time chat application with AI-powered features.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter&display=swap"
          rel="stylesheet"
        ></link>
      </head>
      <body className="font-body antialiased h-full">
        <header className="bg-background p-4 flex items-center">
          <div className="container mx-auto flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="ChroBot Logo"
              width={64}
              height={40}
            />
            <h1 className="font-headline text-2xl text-primary">
              ChroBot
            </h1>
          </div>
        </header>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
