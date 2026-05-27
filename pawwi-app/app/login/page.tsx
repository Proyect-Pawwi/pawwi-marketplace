"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleRegister() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });

    if (error) {
      alert("No se pudo crear la cuenta");
      return;
    }

    alert("Revisa tu correo para verificar tu cuenta");
  }

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Credenciales inválidas");
      return;
    }

    alert("Login exitoso");
  }

  return (
    <div className="p-10 flex flex-col gap-4 max-w-md">
      <input
        type="email"
        placeholder="Email"
        className="border p-2"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        className="border p-2"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleRegister}
        className="bg-black text-white p-2"
      >
        Registrarse
      </button>

      <button
        onClick={handleLogin}
        className="bg-blue-600 text-white p-2"
      >
        Login
      </button>
    </div>
  );
}