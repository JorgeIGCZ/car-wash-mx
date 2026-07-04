import Link from "next/link";
import { BadgeCheck, KeyRound, LogOut, ShieldCheck, Users } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PersonnelPage() {
  const currentUser = await requireUser();
  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      _count: {
        select: { washesCreated: true, washParticipations: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mobile-page personnel-page">
      <PageHero title="Personal">
        <div className="profile-summary">
          <div className="profile-avatar">
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{currentUser.email}</span>
            <small>
              {currentUser.role === "ADMIN" ? "Administrador" : "Encargado"}
            </small>
          </div>
        </div>
      </PageHero>

      <section className="team-section">
        <div className="content-heading">
          <Users size={22} />
          <div>
            <h2>Equipo activo</h2>
            <p>Estas personas pueden participar en los lavados.</p>
          </div>
        </div>
        <div className="team-list">
          {users.map((user) => (
            <article key={user.id}>
              <div className="small-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <small>
                  {user._count.washesCreated} registrados ·{" "}
                  {user._count.washParticipations} participaciones
                </small>
              </div>
              <div className={`role-badge ${user.role.toLowerCase()}`}>
                {user.role === "ADMIN" ? <ShieldCheck size={15} /> : <BadgeCheck size={15} />}
                {user.role === "ADMIN" ? "Admin" : "Encargado"}
              </div>
            </article>
          ))}
        </div>
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
