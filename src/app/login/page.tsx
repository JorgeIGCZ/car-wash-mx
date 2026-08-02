"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
    } catch {
      setError("No fue posible conectar con el servidor.");
      setLoading(false);
      return;
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "No fue posible iniciar sesión.");
      setLoading(false);
      return;
    }

    router.push(data.mustChangePassword ? "/change-password" : "/register");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <Image
            src="/turbo-wash-logo.png"
            alt="Turbo Wash Auto Spa"
            width={420}
            height={420}
            priority
          />
        </div>
        <div className="login-content">
          <p className="eyebrow">CONTROL DE SERVICIOS</p>
          <h1>Bienvenido</h1>
          <p className="muted">Ingresa con tu cuenta para registrar lavados.</p>

          <form onSubmit={submit} className="stack-form">
            <label>
              Correo
              <span className="input-with-icon">
                <Mail size={20} />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </span>
            </label>
            <label>
              Contraseña
              <span className="input-with-icon">
                <LockKeyhole size={20} />
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </span>
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button full" disabled={loading}>
              {loading ? "Ingresando…" : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
