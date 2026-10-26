import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ReferenceEffects } from "@/components/reference-effects";
import { appEnv } from "@/lib/config/env";
import { jetbrainsMono, quicksandDisplay, quicksandUi } from "@/components/fonts";
import "./globals.css";
import "./theme.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "http://localhost:3000";

const metadataBase = new URL(
  siteUrl.startsWith("http://") || siteUrl.startsWith("https://")
    ? siteUrl
    : `https://${siteUrl}`
);

export const metadata: Metadata = {
  metadataBase,
  title: appEnv.appName,
  description: appEnv.description,
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: appEnv.appName,
    description: appEnv.description,
    url: "/",
    siteName: appEnv.appName,
    images: [
      {
        url: "/og-image.webp",
        width: 1731,
        height: 909,
        alt: `${appEnv.appName} — ${appEnv.tagline}`,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: appEnv.appName,
    description: appEnv.description,
    images: ["/og-image.webp"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${quicksandDisplay.variable} ${quicksandUi.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
          <ReferenceEffects />
        </Providers>
      </body>
    </html>
  );
}
