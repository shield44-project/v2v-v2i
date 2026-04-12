import type { Metadata } from "next";
import "./globals.css";
import SupportIssueMailButton from "@/app/_components/support-issue-mail-button";

export const metadata: Metadata = {
  title: "V2X Connect",
  description: "Secure V2X dashboard with Vercel + Google sign-in",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <SupportIssueMailButton />
      </body>
    </html>
  );
}
