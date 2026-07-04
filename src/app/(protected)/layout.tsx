import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell user={{ name: user.name, role: user.role }}>
      {children}
    </AppShell>
  );
}
