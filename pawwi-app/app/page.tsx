"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
    }

    getUser();
  }, []);

  return (
    <div className="p-10">
      {user ? (
        <div>
          <p>Logueado como:</p>
          <p>{user.email}</p>
        </div>
      ) : (
        <p>No autenticado</p>
      )}
    </div>
  );
}