import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Faya Admin Portal — Country Operations & Compliance",
  description:
    "Internal admin system for Faya staff to manage fintech operations across African countries: KYC/KYB review, risk monitoring, settlements, devices, disputes, and regulatory reporting.",
  keywords: [
    "Faya",
    "Admin Portal",
    "KYC",
    "KYB",
    "Compliance",
    "Fintech",
    "Africa",
    "Firebase",
    "Next.js",
  ],
  authors: [{ name: "Faya Operations" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Faya Admin Portal",
    description: "Country operations, staff roles & compliance for Faya fintech.",
    siteName: "Faya Admin Portal",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Faya Admin Portal",
    description: "Country operations, staff roles & compliance for Faya fintech.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
