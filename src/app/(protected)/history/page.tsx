import { WashHistory } from "@/components/WashHistory";
import { canAccessAdministration, requireUser } from "@/lib/auth";

export default async function HistoryPage() {
  const user = await requireUser();
  return <WashHistory canEditDetails={canAccessAdministration(user.role)} />;
}
