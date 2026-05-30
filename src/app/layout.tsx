import type { Metadata } from "next";
import { Saira, Saira_Condensed, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const saira = Saira({
  subsets: ["latin"],
  variable: "--font-saira",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const sairaCondensed = Saira_Condensed({
  subsets: ["latin"],
  variable: "--font-saira-condensed",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "No Hubble — Fantasy ADP, traded like stock",
  description:
    "Fantasy football ADP visualized as a trading floor. Real movement from daily snapshots.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${saira.variable} ${sairaCondensed.variable} ${jetbrainsMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
