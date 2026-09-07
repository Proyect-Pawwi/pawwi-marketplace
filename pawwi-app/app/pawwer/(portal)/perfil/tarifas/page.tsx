import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import TarifasClient, { type ServiceEdit } from "./TarifasClient";

interface Row {
  id_service: number;
  price: number;
  is_active: boolean;
  max_animals: number;
  max_size: number;
}

// service_type.id → nombre (fijo en el codebase: 1=DayCare, 2=Night, 3=Travel, 4=Express).
// Evitamos el embed `service_type(name)` porque sin el hint de FK es ambiguo y PostgREST
// devuelve error (data=null) → la lista salía vacía.
const NAME_BY_ID: Record<number, string> = { 1: "DayCare", 2: "Night", 3: "Travel", 4: "Express" };

export default async function TarifasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const [servicesRes, pawwerRes] = await Promise.all([
    supabase
      .from("service_X_Pawwer")
      .select("id_service, price, is_active, max_animals, max_size")
      .eq("id_pawwer", user.id)
      .order("id_service"),
    supabase.from("pawwer").select("rating, reviews_count, transport_price").eq("id", user.id).maybeSingle(),
  ]);

  if (servicesRes.error) {
    console.error("[Pawwi] tarifas servicios:", servicesRes.error.message, servicesRes.error.details);
  }

  const rows = (servicesRes.data as unknown as Row[]) ?? [];
  const services: ServiceEdit[] = rows.map((r) => ({
    idService: r.id_service,
    name: NAME_BY_ID[r.id_service] ?? `Servicio ${r.id_service}`,
    price: Number(r.price) || 0,
    isActive: r.is_active,
    maxAnimals: r.max_animals ?? 1,
    maxSize: r.max_size ?? 3,
  }));

  return (
    <TarifasClient
      services={services}
      rating={(pawwerRes.data?.rating as number | null) ?? 0}
      reviewsCount={(pawwerRes.data?.reviews_count as number | null) ?? 0}
      transportPrice={(pawwerRes.data?.transport_price as number | null) ?? 0}
    />
  );
}
