import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** Enveloppe les route handlers : renvoie des erreurs JSON lisibles. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: (e as Error).message ?? "Erreur serveur" }, { status: 500 });
    }
  };
}

export async function body(req: Request) {
  return (await req.json().catch(() => ({}))) as unknown;
}
