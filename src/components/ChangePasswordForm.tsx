"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LockKeyhole, LogOut } from "lucide-react";

export function ChangePasswordForm({
  forced,
  userName,
}: {
  forced: boolean;
  userName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (newPassword !== confirmation) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "No fue posible cambiar la contraseña.");
      setLoading(false);
      return;
    }

    router.push("/login");
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
        <div className="login-content password-content">
          <p className="eyebrow">SEGURIDAD DE LA CUENTA</p>
          <h1>{forced ? "Crea una contraseña nueva" : "Cambiar contraseña"}</h1>
          <p className="muted">
            {forced
              ? `${userName}, debes reemplazar tu contraseña temporal para continuar.`
              : `${userName}, confirma tu contraseña actual antes de cambiarla.`}
          </p>
          <form className="stack-form" onSubmit={submit}>
            <label>
              Contraseña actual
              <span className="input-with-icon">
                <LockKeyhole size={20} />
                <input name="currentPassword" type="password" autoComplete="current-password" required />
              </span>
            </label>
            <label>
              Nueva contraseña
              <span className="input-with-icon">
                <KeyRound size={20} />
                <input name="newPassword" type="password" minLength={10} autoComplete="new-password" required />
              </span>
            </label>
            <label>
              Confirmar contraseña
              <span className="input-with-icon">
                <KeyRound size={20} />
                <input name="confirmation" type="password" minLength={10} autoComplete="new-password" required />
              </span>
            </label>
            <p className="password-hint">Usa al menos 10 caracteres y evita reutilizar la contraseña anterior.</p>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button full" disabled={loading}>
              {loading ? "Actualizando…" : "Guardar nueva contraseña"}
            </button>
          </form>
          <form action="/api/auth/logout" method="post">
            <button className="secondary-button full" type="submit">
              <LogOut size={20} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
