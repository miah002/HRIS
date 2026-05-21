import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
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

export const metadata: Metadata = {
  title: { default: "Sahod HR — DOLE-compliant HR for PH businesses", template: "%s · Sahod HR" },
  description: "Semi-monthly payroll, DTR, SSS/PhilHealth/Pag-IBIG/BIR compliance, and statutory leaves — for Philippine SMEs.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Sahod HR", statusBarStyle: "black-translucent" },
  openGraph: { title: "Sahod HR", description: "HR software built for the Filipino SME hustle.", type: "website" },
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
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}
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
