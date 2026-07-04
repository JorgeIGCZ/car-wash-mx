import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { getCurrentUser } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser({ allowPasswordChange: true });
  if (!user) redirect("/login");

  return (
    <ChangePasswordForm
      forced={user.mustChangePassword}
      userName={user.name}
    />
  );
}
