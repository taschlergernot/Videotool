import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Videotool",
  description: "Projekt- und Upload-Verwaltung fuer das KI Video Editing Studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
