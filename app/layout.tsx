import type { Metadata, Viewport } from "next";
import { Bowlby_One_SC, DM_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { brand } from "@/lib/brand/tokens";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

/*
 * The brand pairing: a fat poster face shouting over a monospace that whispers.
 * Both are SIL OFL, so next/font self-hosts them at build time — no request
 * ever leaves for Google.
 *
 * Bowlby One SC only ships a single weight and only draws small caps, which is
 * why every heading is uppercase in the base layer: lowercase input renders as
 * small caps anyway, and `text-transform` is what keeps that deliberate.
 */
const bowlby = Bowlby_One_SC({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-bowlby",
});

/*
 * DM Mono tops out at 500 — there is no 700 to download. `font-bold` on a
 * button therefore renders synthesised, which is what the reference does too;
 * on a monospace the faux weight is even across the face and reads correctly.
 */
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-dm-mono",
});

const DESCRIPTION =
  "Upload a photo, get it back inside an HH Goa 2026 frame. No signup, no account — your photo never leaves your device.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Frame yourself for Goa`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Frame yourself for Goa`,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  // No image yet: the site card is pre-rendered in T-026 and the per-share
  // cards in T-024. Declaring a card type without one would ship a blank thumb.
  twitter: { card: "summary", creator: "@247pmstudio" },
};

export const viewport: Viewport = {
  themeColor: brand.color.primary,
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bowlby.variable} ${dmMono.variable} h-full antialiased`}>
      {/* `overflow-x-clip`: the hero and footer scenery deliberately bleed past
          their boxes (sun, palms), and clip-at-the-viewport is what keeps that
          from becoming a horizontal scrollbar on a 360px phone. `clip` rather
          than `hidden` so the body never becomes a scroll container — sticky
          header positioning survives. */}
      <body className="flex min-h-full flex-col overflow-x-clip">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
