import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";

import { AppProviders } from "@/components/app-providers";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const uiInter = localFont({
  src: "./fonts/inter-ui-latin.woff2",
  variable: "--font-inter-ui",
  weight: "100 900",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0020-007E,U+00A0,U+00B7,U+00C0-00FF,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026" }],
});

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

function GoogleAnalyticsTag() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${uiInter.variable} ${inter.variable}`}>
      <body>
        <picture className="site-backdrop">
          <source srcSet="/assets/ambient-blue-backdrop-screen.avif" type="image/avif" />
          <img src="/assets/ambient-blue-backdrop-screen.webp" alt="" fetchPriority="low" loading="lazy" />
        </picture>
        <AppProviders>{children}</AppProviders>
        <GoogleAnalyticsTag />
      </body>
    </html>
  );
}
