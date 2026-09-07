import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import VitrinaClient from "./VitrinaClient";

export default async function VitrinaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data } = await supabase
    .from("pawwer")
    .select("profession, bio, experience, response_time, neighborhood, animales_en_casa, tipo_inmueble, areas_externas, ninos_pequenos, mi_espacio, valores, years_experience")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <VitrinaClient
      initial={{
        profession: (data?.profession as string | null) ?? "",
        bio: (data?.bio as string | null) ?? "",
        experience: (data?.experience as string[] | null) ?? [],
        responseTime: (data?.response_time as string | null) ?? "",
        neighborhood: (data?.neighborhood as string | null) ?? "",
        animalesEnCasa: (data?.animales_en_casa as string[] | null) ?? [],
        tipoInmueble: (data?.tipo_inmueble as string | null) ?? "",
        areasExternas: (data?.areas_externas as string[] | null) ?? [],
        ninosPequenos: (data?.ninos_pequenos as boolean | null) ?? false,
        miEspacio: (data?.mi_espacio as string | null) ?? "",
        valores: (data?.valores as string | null) ?? "",
        yearsExperience: (data?.years_experience as number | null) ?? 0,
      }}
    />
  );
}
