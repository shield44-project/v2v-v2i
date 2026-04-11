import "./globals.css";

export const metadata = {
  title: "V2X Connect",
  description: "Next.js host for the V2V/V2I simulation stack"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
