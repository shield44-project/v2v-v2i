import type { Metadata, Viewport } from "next";
import Image from "next/image";
import "./globals.css";
import SupportIssueMailButton from "@/app/_components/support-issue-mail-button";
import AppFooter from "@/app/_components/app-footer";

export const metadata: Metadata = {
  title: "V2X Connect - Tech Titans",
  description: "Real-time V2V/V2I Emergency Vehicle Clearance System | Emission-Optimized Traffic Management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "V2X Connect",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/tech-titans-logo.svg", type: "image/svg+xml" },
    ],
    apple: "/tech-titans-logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#00f5ff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <style>{`
          ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }
          ::-webkit-scrollbar-track {
            background: var(--bg-secondary);
          }
          ::-webkit-scrollbar-thumb {
            background: var(--purple);
            border-radius: 5px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: var(--cyan);
          }
        `}</style>
      </head>
      <body className="min-h-full flex flex-col bg-neo-bg-primary text-neo-text-primary">
        <header className="sticky top-0 z-50 bg-gradient-to-r from-neo-bg-primary via-neo-bg-secondary to-neo-bg-primary border-b border-neo-border backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <Image src="/tech-titans-logo.svg" alt="Tech Titans" width={40} height={40} className="w-10 h-10" />
                <div>
                  <h1 className="text-neo-gradient font-bold text-xl tracking-tight">V2X Connect</h1>
                  <p className="text-xs text-neo-text-muted">by Tech Titans</p>
                </div>
              </div>

              {/* Right side - breathing room */}
              <div className="text-right">
                <p className="text-xs text-neo-text-muted">Emission-Aware Traffic</p>
                <p className="text-xs text-neo-accent-1 font-semibold">Real-time V2V/V2I Network</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>
        <AppFooter />
        <SupportIssueMailButton />
      </body>
    </html>
  );
}
