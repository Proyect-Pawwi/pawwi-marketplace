import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import PagoClient from "./PagoClient";

interface PagoData {
  banco: string;
  tipo_cuenta: string;
  titular: string;
  documento: string;
  llave_tipo: string;
  llave_valor: string;
  numero_mask: string;
  has_numero: boolean;
  has_cert: boolean;
}

export default async function PagoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data } = await supabase.rpc("get_pawwer_pago");
  const p = (data as PagoData | null) ?? null;

  return (
    <PagoClient
      userId={user.id}
      initial={{
        banco: p?.banco ?? "",
        tipo: p?.tipo_cuenta ?? "",
        titular: p?.titular ?? "",
        documento: p?.documento ?? "",
        llaveTipo: p?.llave_tipo ?? "",
        llaveValor: p?.llave_valor ?? "",
      }}
      numeroMask={p?.numero_mask ?? ""}
      hasNumero={p?.has_numero ?? false}
      hasCert={p?.has_cert ?? false}
    />
  );
}
