import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import BottomNav from "./BottomNav";
import { NotificationsProvider } from "./NotificationsProvider";
import { PresenceProvider } from "./PresenceProvider";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data: pawwer } = await supabase
    .from("pawwer")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (!pawwer || pawwer.status !== "approved") redirect("/pawwer/dashboard");

  return (
    <NotificationsProvider userId={user.id}>
      <PresenceProvider>
      <div className="min-h-screen bg-[#FFF1EB] pb-32 relative overflow-x-hidden">
        {/* Blobs decorativos ESTÁTICOS (sin animación float: el blur-[90px]
            animándose en loop era caro en móvil; el look no cambia). */}
        <div
          aria-hidden
          className="pointer-events-none fixed top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[90px] opacity-40 z-0"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed top-[20%] right-[-20%] w-[300px] h-[300px] bg-[#FF7031] rounded-full mix-blend-multiply filter blur-[90px] opacity-20 z-0"
        />
        <div className="relative z-10">
          {children}
          <BottomNav />
        </div>
      </div>
      </PresenceProvider>
    </NotificationsProvider>
  );
}
