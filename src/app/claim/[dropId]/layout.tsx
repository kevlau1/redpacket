import type { Metadata } from "next";

type Props = { params: Promise<{ dropId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { dropId } = await params;
  const title = "🧧 Redpocket — claim into stealth";
  const description =
    "Open this Redpocket in Ready and claim into your STRK20 shielded balance. One wallet, one claim.";
  return {
    title: "Claim a Redpocket",
    description,
    openGraph: {
      title,
      description,
      url: `/claim/${dropId}`,
      siteName: "Redpocket",
      type: "website",
      images: [{ url: "/redpocket-hero.jpg", width: 1536, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/redpocket-hero.jpg"],
    },
  };
}

export default function ClaimDropLayout({ children }: { children: React.ReactNode }) {
  return children;
}
