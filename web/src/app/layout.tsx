import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader, SiteFooter } from "@/components/site";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://greenlight-algo-dao-30577dec.vercel.app"),
  title: "Greenlight",
  description:
    "Greenlight lets an AI agent trade with your money, within a limit you sign once, and automatically raises, lowers or freezes that limit based on how the agent's trades actually turn out.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} min-h-dvh antialiased`}>
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
