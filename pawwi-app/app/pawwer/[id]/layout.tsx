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

/**
 * El perfil público es una pantalla DEL CLIENTE, aunque su URL viva bajo
 * `/pawwer/` — es donde el cliente decide a quién le entrega su perro. Por eso
 * recibe el mismo marco que el grupo `(cliente)`: tipografía, fondo y atmósfera.
 *
 * No se mueve a un grupo: su URL es `/pawwer/[id]` y este layout ya existía
 * para los metadatos de Open Graph, así que el marco entra aquí.
 *
 * La página trae su propio pie fijo con el CTA en móvil, así que **sin `pb-32`**.
 */
export default function PawwerProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream font-sans text-midnight relative overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed top-[-10%] right-[-15%] w-[340px] h-[340px] bg-plum rounded-full mix-blend-multiply blur-[90px] opacity-35 z-0"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-[5%] left-[-15%] w-[260px] h-[260px] bg-tangerine rounded-full mix-blend-multiply blur-[90px] opacity-15 z-0"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
