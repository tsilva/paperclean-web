import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppProviders } from "@/components/app-providers";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://paperclean.tsilva.eu"),
  title: { default: "PaperClean — trustworthy document cleanup", template: "%s · PaperClean" },
  description: "Clean photographed documents without silently changing their content.",
  openGraph: {
    title: "PaperClean",
    description: "Turn rough document photos into clean, trustworthy files.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06152d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
