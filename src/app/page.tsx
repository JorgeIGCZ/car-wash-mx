import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser({ allowPasswordChange: true });
  redirect(user ? (user.mustChangePassword ? "/change-password" : "/register") : "/login");
}
