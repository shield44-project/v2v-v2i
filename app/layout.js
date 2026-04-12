import "./globals.css";
import { Space_Grotesk, Sora } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space"
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora"
});

export const metadata = {
  title: "V2X Connect",
  description: "Next.js host for the V2V/V2I simulation stack"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${sora.variable}`}>{children}</body>
    </html>
  );
}
