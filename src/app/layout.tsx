import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PrototypeBar } from "@/components/prototype-bar";
import { ReferenceEffects } from "@/components/reference-effects";
import { appEnv } from "@/lib/config/env";
import { hankenGrotesk, jetbrainsMono, sora } from "@/components/fonts";
import "./globals.css";
import "./theme.css";

export const metadata: Metadata = {
  title: appEnv.appName,
  description: appEnv.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sora.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>
          <PrototypeBar />
          <SiteHeader />
          {children}
          <SiteFooter />
          <ReferenceEffects />
        </Providers>
      </body>
    </html>
  );
}
