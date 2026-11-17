import { NextResponse } from "next/server";
import { isDemo } from "@/lib/config";
import { demoLoginEnabled } from "@/lib/auth";

/** Indique à l'interface les services en mode démo et si la connexion en un clic est active. */
export async function GET() {
  return NextResponse.json({ demo: isDemo, demoLogin: demoLoginEnabled() });
}
