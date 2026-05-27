import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif, Poppins } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Display font for hero headlines and emotional moments
const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

// Heading font — clean, modern, professional
const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "MMTSI HRIS", template: "%s · MMTSI HRIS" },
  description: "MMTSI internal HR system — payroll, DTR, compliance, and leaves.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "MMTSI HRIS", statusBarStyle: "black-translucent" },
  openGraph: { title: "MMTSI HRIS", description: "MMTSI internal HR system.", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)",  color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable} ${poppins.variable}`}
    >
      <body className="min-h-screen bg-surface antialiased">
        <Providers>
          {children}
        </Providers>
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}` }} />
      </body>
    </html>
  );
}
