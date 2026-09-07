import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import FotosClient from "./FotosClient";

interface ImgRow { url: string; sort_order: number; }

export default async function FotosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data } = await supabase.rpc("get_pawwer_images");
  const images = ((data as ImgRow[] | null) ?? []).map((r) => r.url);

  return <FotosClient userId={user.id} initial={images} />;
}
