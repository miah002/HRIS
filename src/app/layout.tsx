import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sahod HR — DOLE-compliant HR for PH businesses",
  description: "DOLE/BIR/SSS/PhilHealth/Pag-IBIG-ready HR & payroll for Philippine SMEs.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Sahod HR", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {})); }`,
          }}
        />
      </body>
    </html>
  );
}
