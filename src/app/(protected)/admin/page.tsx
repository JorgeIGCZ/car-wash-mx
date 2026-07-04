import { AdminPanel } from "@/components/AdminPanel";
import { requireAdministration } from "@/lib/auth";

export default async function AdminPage() {
  await requireAdministration();
  return <AdminPanel />;
}
