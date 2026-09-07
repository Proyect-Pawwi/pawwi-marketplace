import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { createClient } from "@/lib/server";
import type { BookingRow } from "@/app/actions/portal";
import BookingDetail from "./BookingDetail";

export default async function CuidadoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { id } = await params;

  const [{ data }, { data: pawwerData }] = await Promise.all([
    supabase.rpc("get_pawwer_booking_detail", { p_booking_id: id }),
    supabase.from("pawwer").select("lat, lng").eq("id", user.id).maybeSingle(),
  ]);

  // Si ya no tienes acceso a esta reserva (la declinaste o la tomó otro Pawwer),
  // mostramos una pantalla amable en vez de un 404.
  if (!data) {
    return (
      <div className="min-h-screen bg-[#FFF1EB] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-white flex items-center justify-center mb-5 shadow-[0_12px_30px_rgba(18,10,43,0.06)] text-gray-300">
          <CalendarX2 size={30} />
        </div>
        <h1 className="text-xl font-black text-[#120A2B] mb-1.5">Este cuidado ya no está en tu lista</h1>
        <p className="text-sm text-gray-500 max-w-xs mb-7 leading-relaxed">
          Puede que lo hayas declinado o que ya lo haya tomado otro Pawwer.
        </p>
        <Link
          href="/pawwer/cuidados"
          className="bg-[#120A2B] text-white font-bold text-sm px-6 py-3.5 rounded-full active:scale-95 transition-transform"
        >
          Volver a mis cuidados
        </Link>
      </div>
    );
  }

  return (
    <BookingDetail
      booking={data as BookingRow}
      userId={user.id}
      pawwerLat={pawwerData?.lat ?? null}
      pawwerLng={pawwerData?.lng ?? null}
    />
  );
}
