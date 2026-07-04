"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CircleUserRound,
  ClipboardPlus,
  History,
  LogOut,
  Settings,
} from "lucide-react";

type AppShellProps = {
  user: {
    name: string;
    role: "ADMIN" | "ADMINISTRATIVE" | "EMPLOYEE";
  };
  children: React.ReactNode;
};

const baseLinks = [
  { href: "/register", label: "Registrar", icon: ClipboardPlus },
  { href: "/history", label: "Historial", icon: History },
  { href: "/personnel", label: "Perfil", icon: CircleUserRound },
];

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const links =
    user.role === "ADMIN"
      ? [...baseLinks, { href: "/admin", label: "Administrar", icon: Settings }]
      : user.role === "ADMINISTRATIVE"
        ? [
            { href: "/personnel", label: "Perfil", icon: CircleUserRound },
            { href: "/admin", label: "Administrar", icon: Settings },
          ]
        : baseLinks;

  return (
    <div className="app-frame">
      <aside className="desktop-sidebar">
        <div className="sidebar-logo">
          <Image
            src="/turbo-wash-logo.png"
            alt="Turbo Wash"
            width={220}
            height={220}
            priority
          />
        </div>
        <nav>
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);
            return (
              <Link className={active ? "active" : ""} href={link.href} key={link.href}>
                <Icon size={21} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <span>{user.name}</span>
          <small>
            {user.role === "ADMIN"
              ? "Administrador"
              : user.role === "ADMINISTRATIVE"
                ? "Administrativo"
                : "Encargado"}
          </small>
          <form action="/api/auth/logout" method="post">
            <button type="submit">
              <LogOut size={17} /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="app-content">{children}</main>

      <nav className="mobile-nav">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);
          return (
            <Link className={active ? "active" : ""} href={link.href} key={link.href}>
              <Icon size={22} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
