import Image from "next/image";

// app/page.tsx

export default function Home() {
  console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)

  return (
    <div>
      Proyecto funcionando Pawwi
    </div>
  )
}
