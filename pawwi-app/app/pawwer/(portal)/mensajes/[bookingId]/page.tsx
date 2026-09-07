import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/server";
import type { BookingRow } from "@/app/actions/portal";
import ChatRoom from "./ChatRoom";

// El chat nunca se cachea: al volver a entrar debe traer los mensajes frescos
// (si no, Next sirve la versión cacheada sin el último mensaje enviado).
export const dynamic = "force-dynamic";

interface MessageRow {
  id: string;
  booking_id: string;
  sender_id: string | null;
  content: string;
  photo_url: string | null;
  is_daily_report: boolean;
  is_system: boolean;
  created_at: string;
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { bookingId } = await params;

  const [bookingRes, messagesRes, pawwerRes] = await Promise.all([
    supabase.rpc("get_pawwer_booking_detail", { p_booking_id: bookingId }),
    supabase
      .from("messages")
      .select("id, booking_id, sender_id, content, photo_url, is_daily_report, is_system, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase.from("pawwer").select("lat, lng").eq("id", user.id).maybeSingle(),
  ]);

  if (!bookingRes.data) notFound();

  const booking = bookingRes.data as BookingRow;
  const messages = (messagesRes.data as MessageRow[]) ?? [];

  return (
    <ChatRoom
      booking={booking}
      initialMessages={messages}
      userId={user.id}
      pawwerLat={(pawwerRes.data?.lat as number | null) ?? null}
      pawwerLng={(pawwerRes.data?.lng as number | null) ?? null}
    />
  );
}
