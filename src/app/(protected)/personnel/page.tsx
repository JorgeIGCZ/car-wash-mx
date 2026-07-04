import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { requireUser } from "@/lib/auth";

export default async function PersonnelPage() {
  const currentUser = await requireUser();

  return (
    <div className="mobile-page personnel-page">
      <PageHero title="Perfil">
        <div className="profile-summary">
          <div className="profile-avatar">
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{currentUser.email}</span>
            <small>
              {currentUser.role === "ADMIN"
                ? "Administrador"
                : currentUser.role === "ADMINISTRATIVE"
                  ? "Administrativo"
                  : "Encargado"}
            </small>
          </div>
        </div>
      </PageHero>

      <section className="profile-actions-section">
        <Link className="secondary-button change-password-link" href="/change-password">
          <KeyRound size={19} />
          Cambiar mi contraseña
        </Link>
        <form action="/api/auth/logout" method="post">
          <button className="secondary-button logout-button" type="submit">
            <LogOut size={19} />
            Cerrar sesión
          </button>
        </form>
      </section>
    </div>
  );
}
