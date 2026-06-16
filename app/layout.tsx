/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MisinfoTracker — Community Fact-Check Platform",
  description: "Submit claims, attach evidence, and get transparent community-verified verdicts on misinformation.",
  verification: {
    google: "ANX-l8lict2wskSEcpHDeSb_0I7iJbFYfzmfyhocBG0",
  },
  openGraph: {
    title: "MisinfoTracker — Community Fact-Check Platform",
    description: "Submit claims, attach evidence, and get transparent community-verified verdicts on misinformation.",
    type: "website",
    siteName: "MisinfoTracker",
  },
  twitter: {
    card: "summary_large_image",
    title: "MisinfoTracker — Community Fact-Check Platform",
    description: "Submit claims, attach evidence, and get transparent community-verified verdicts on misinformation.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090d",
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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="mesh-bg" />
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  );
}
