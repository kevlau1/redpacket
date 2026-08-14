import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0d10",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "Redpocket · Password Redpockets, stealth claims",
  description: "Password Redpockets that claim into your STRK20 shielded balance",
  openGraph: {
    title: "🧧 Redpocket — claim into stealth",
    description: "Set a password, share one link. Claims land in a STRK20 shielded balance.",
    siteName: "Redpocket",
    type: "website",
    images: [{ url: "/redpocket-hero.jpg", width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "🧧 Redpocket — claim into stealth",
    description: "Password Redpockets that claim into your STRK20 shielded balance",
    images: ["/redpocket-hero.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
