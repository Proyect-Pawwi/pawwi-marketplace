import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/server";

const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { name: string | null } | null;
}

// Fecha determinística en hora de Bogotá (server component).
function fmtDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default async function ResenasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, reviewer:profile!reviews_client_id_fkey ( name )")
    .eq("pawwer_id", user.id)
    .order("created_at", { ascending: false });

  const reviews = (data as unknown as ReviewRow[]) ?? [];
  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length : 0;

  return (
    <div className="min-h-screen relative pb-10 font-sans">
      <header className="relative z-20 pt-12 pb-3">
        <div className="max-w-xl mx-auto px-6 flex items-center gap-4">
          <Link href="/pawwer/perfil" className="w-10 h-10 bg-white/80 backdrop-blur-md border border-white rounded-[14px] flex items-center justify-center text-[#120A2B] shadow-[0_8px_20px_rgba(18,10,43,0.05)] active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="eyebrow text-[#FF7031] ">Tu reputación</p>
            <h1 className="text-2xl font-black text-[#120A2B] leading-none mt-0.5">Mis reseñas</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-3">
        {reviews.length > 0 && (
          <div className="bg-white rounded-[24px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5 flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-black text-[#120A2B] leading-none">{avg.toFixed(1)}</p>
              <div className="flex gap-0.5 mt-1.5 justify-center">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={13} className={i < Math.round(avg) ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
                ))}
              </div>
            </div>
            <div className="h-10 w-px bg-gray-100" />
            <p className="text-sm text-[#120A2B]/55 font-semibold">
              {reviews.length} reseña{reviews.length !== 1 ? "s" : ""} de tus clientes
            </p>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-[28px] border border-white/80 p-10 text-center shadow-[0_12px_30px_rgba(18,10,43,0.03)]">
            <div className="w-14 h-14 rounded-full bg-[#FFF1EB] flex items-center justify-center mx-auto mb-3">
              <MessageSquare size={24} className="text-[#FF7031]" />
            </div>
            <p className="text-sm font-black text-[#120A2B]">Aún no tienes reseñas</p>
            <p className="text-xs text-[#120A2B]/45 mt-1.5 leading-relaxed">
              Cuando completes cuidados, tus clientes podrán calificarte y sus reseñas aparecerán aquí.
            </p>
          </div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-[22px] border border-white shadow-[0_10px_30px_-12px_rgba(18,10,43,0.12)] p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-extrabold text-[#120A2B]">{r.reviewer?.name || "Cliente verificado"}</p>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={12} className={i < Number(r.rating) ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
                  ))}
                </div>
              </div>
              {r.comment && <p className="text-sm text-[#120A2B]/70 leading-relaxed italic">&ldquo;{r.comment}&rdquo;</p>}
              <p className="text-[11px] text-[#120A2B]/35 mt-2">{fmtDate(r.created_at)}</p>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
