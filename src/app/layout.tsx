import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Spaceships",
  description:
    "A ship-combat card game played with one standard deck, against an opponent trained by self-play.",
  applicationName: "Spaceships",
  openGraph: {
    title: "Spaceships",
    description:
      "Health, a permanent shield, and a bank of face-down charges nobody may look at — not even you.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#17150F",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
