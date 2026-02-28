import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Paabola — Football Picks",
  description: "Premier League score prediction game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased bg-background text-foreground`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
