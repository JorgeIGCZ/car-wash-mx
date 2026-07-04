import { deleteCurrentSession } from "@/lib/auth";

export async function POST() {
  await deleteCurrentSession();
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
    },
  });
}
