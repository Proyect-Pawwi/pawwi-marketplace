import type { Metadata } from "next";
import { createClient } from "@/lib/server";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("pawwer")
    .select(`
      neighborhood, bio,
      profile!pawwer_profile_fk ( name, avatar_url ),
      images:Pawwer_images ( image )
    `)
    .eq("id", id)
    .maybeSingle();

  const name         = (data?.profile as { name?: string } | null)?.name ?? "Pawwer";
  const neighborhood = data?.neighborhood ?? "Bogotá";
  const bio          = (data?.bio as string | null) ?? "Cuidador verificado de perros en Bogotá";
  const imageVal     = (data?.images as { image?: unknown }[] | null)?.[0]?.image;
  const image        = typeof imageVal === "string" && imageVal.startsWith("http") ? imageVal : null;

  const title       = `Cuidado de perros en ${neighborhood} - ${name}`;
  const ogImages    = image ? [{ url: image, width: 800, height: 600, alt: name }] : [];

  return {
    title,
    description: bio,
    openGraph: {
      title: `${name} | Cuidador de perros en ${neighborhood}`,
      description: bio,
      images: ogImages,
      type: "profile",
      locale: "es_CO",
      siteName: "Pawwi",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | Cuidador en ${neighborhood}`,
      description: bio,
      images: image ? [image] : [],
    },
  };
}

export default function PawwerProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
