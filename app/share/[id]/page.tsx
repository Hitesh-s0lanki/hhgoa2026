import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download } from "lucide-react";
import { Lotus, Sparkle, Waves } from "@/components/brand/ornaments";
import { Button } from "@/components/ui/button";
import { getPass } from "@/lib/db/passes";
import { buildXIntentUrl } from "@/lib/share/x";
import { EVENT, SHARE_HASHTAG, SITE_NAME, absoluteUrl } from "@/lib/site";

/**
 * `/share/[id]` — the page a posted link points at.
 *
 * It has two audiences and they want different things. A crawler wants
 * `og:image`; it never renders the body. A person who tapped the link wants to
 * see the pass big, and then — this is the actual conversion — to find out they
 * can make one. So the page is the card, the name, and one button.
 *
 * The row is the only reason a database exists here: the card lives at an
 * opaque UploadThing URL, so `id → image` stopped being the pure function
 * ADR-004 was written around.
 */

/** Two reads of the same row per request; React dedupes them in one render pass. */
async function load(params: Promise<{ id: string }>) {
  const { id } = await params;
  return getPass(id);
}

export async function generateMetadata({ params }: PageProps<"/share/[id]">): Promise<Metadata> {
  const pass = await load(params);

  if (!pass) {
    return { title: "Pass not found", robots: { index: false, follow: false } };
  }

  const title = `${pass.name} · ${pass.title} — ${SITE_NAME}`;
  const description = `${pass.name}'s builder pass for ${EVENT.name}, ${EVENT.dates}. Make your own with #${SHARE_HASHTAG}.`;

  // The 1200×630 crop, not the sheet: X scales a link thumbnail to roughly 2:1
  // and the two-card sheet arrives clipped at both edges. `cardUrl` is the
  // fallback only because `ogUrl` is nullable for rows written before it, and
  // a wrong-shaped image still beats no image.
  const image = pass.ogUrl ?? pass.cardUrl;
  const url = absoluteUrl(`/share/${pass.id}`);

  return {
    // `absolute` because the root layout's template appends the site name, and
    // this title already carries it — otherwise every share page reads
    // "… — HH Goa 2026 · HH Goa 2026".
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: SITE_NAME,
      images: [{ url: image, width: 1200, height: 630, alt: `${pass.name}'s HH Goa 2026 pass` }],
    },
    // `summary_large_image` is the whole point — the default `summary` card
    // renders a small square thumbnail and crops the card to a crest.
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      creator: "@247pmstudio",
    },
  };
}

export default async function SharePage({ params }: PageProps<"/share/[id]">) {
  const pass = await load(params);
  if (!pass) notFound();

  const detail = [pass.role, pass.stack].filter(Boolean).join("  ·  ");
  const repost = buildXIntentUrl({
    shareUrl: absoluteUrl(`/share/${pass.id}`),
    name: pass.name,
    title: pass.title,
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12 md:py-16">
      <header className="text-center">
        <p className="label-caps text-brand-yellow flex items-center justify-center gap-2 text-[10px]">
          <Sparkle className="animate-twinkle text-brand-pink w-2" />
          {EVENT.name} · {EVENT.dates}
          <Sparkle className="animate-twinkle text-brand-pink w-2 [animation-delay:1.3s]" />
        </p>

        <h1 className="text-offset text-brand-yellow mt-4 text-[clamp(2rem,7vw,3.2rem)] break-words">
          {pass.name}
        </h1>

        <p className="mt-5 inline-flex max-w-full items-center gap-2.5">
          <Lotus className="text-brand-pink w-3.5 shrink-0" />
          <span className="font-display text-offset text-brand-pink truncate text-[clamp(1rem,4vw,1.4rem)] uppercase">
            {pass.title}
          </span>
          <Lotus className="text-brand-pink w-3.5 shrink-0" />
        </p>

        {detail ? <p className="text-brand-cream/75 mt-4 text-[12px]">{detail}</p> : null}
      </header>

      {/* The sheet, not the OG crop: someone who followed the link wants to read
          the card, and this is the file they would download. The offset shadow
          is the site's frame for "this is a printed object". */}
      <div className="relative mx-auto mt-10 w-full max-w-3xl">
        <span
          aria-hidden="true"
          className="bg-brand-ink absolute inset-0 translate-x-2 translate-y-2"
        />
        {/* A remote PNG at a fixed aspect from our own renderer, and the whole
            page is `images.unoptimized` — next/image would add a wrapper and no
            optimization. eslint-disable-next-line @next/next/no-img-element */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pass.cardUrl}
          alt={`${pass.name}'s builder pass — front and back`}
          width={2112}
          height={1668}
          className="border-brand-ink relative block w-full border-2"
        />
      </div>

      <div className="mt-9 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/#generate">
            Make your own pass
            <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          {/* `download` on a cross-origin link is ignored by the browser, so
              this opens the PNG rather than saving it — which is the honest
              behaviour to label. The generator's own Download button saves
              directly because that blob is same-origin. */}
          <a href={pass.cardUrl} target="_blank" rel="noreferrer">
            <Download />
            Open the image
          </a>
        </Button>
      </div>

      <p className="label-caps text-brand-cream/45 mt-10 flex items-center justify-center gap-3 text-center text-[9px]">
        <Waves className="text-brand-cream/25 w-8 shrink-0" />
        <a href={repost} target="_blank" rel="noreferrer" className="hover:text-brand-yellow">
          Repost on X · #{SHARE_HASHTAG}
        </a>
        <Waves className="text-brand-cream/25 w-8 shrink-0" />
      </p>
    </main>
  );
}
