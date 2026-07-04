import { AdminPanel } from "@/components/AdminPanel";
import { requireAdmin } from "@/lib/auth";

export default async function AdminPage() {
  await requireAdmin();
  return <AdminPanel />;
}
