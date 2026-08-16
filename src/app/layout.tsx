import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Spaceships",
  description:
    "A ship-combat card game played with one standard deck, against an opponent trained by self-play.",
  applicationName: "Spaceships",
  manifest: "./manifest.webmanifest",
  // Added to a phone's home screen it opens as its own thing, without the
  // browser's chrome -- which on a phone is most of a card's height back.
  appleWebApp: {
    capable: true,
    title: "Spaceships",
    statusBarStyle: "black-translucent",
  },
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
  width: "device-width",
  initialScale: 1,
  // The table is laid out to fit the screen, so nobody should need to pinch --
  // but pinching stays available, because taking it away breaks the page for
  // anyone who needs to magnify it.
  maximumScale: 5,
  userScalable: true,
  // Paint under the notch and the home indicator; the room pads itself back
  // off them with env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
