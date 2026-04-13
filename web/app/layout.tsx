import type { Metadata, Viewport } from "next";
import "./globals.css";
import SupportIssueMailButton from "@/app/_components/support-issue-mail-button";
import AppFooter from "@/app/_components/app-footer";

export const metadata: Metadata = {
  title: "V2X Connect",
  description: "Real-time V2V/V2I Emergency Vehicle Clearance System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "V2X Connect",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#00e5ff",
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
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <AppFooter />
        <SupportIssueMailButton />
      </body>
    </html>
  );
}
