import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { appEnv } from "@/lib/config/env";
import "./globals.css";

export const metadata: Metadata = {
  title: appEnv.appName,
  description: appEnv.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
