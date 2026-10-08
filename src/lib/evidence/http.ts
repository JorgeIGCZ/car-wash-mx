import { NextResponse } from "next/server";
import { getCurrentUser } from "../auth";
import { EvidenceError } from "./service";
export async function evidenceUser() {
  const user = await getCurrentUser();
  if (!user) throw new EvidenceError(401, "Sesión no válida.");
  return user;
}
export async function evidenceResponse(run: () => Promise<unknown>) {
  try { const result = await run(); if (result instanceof Response) return result; return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) {
    const known = error instanceof EvidenceError;
    // Never log S3 errors: they may carry credentials or signed URLs.
    if (!known) console.error("Evidence operation failed");
    return NextResponse.json({ error: known ? error.message : "La evidencia no está disponible por el momento. Intenta nuevamente." },
      { status: known ? error.status : 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
