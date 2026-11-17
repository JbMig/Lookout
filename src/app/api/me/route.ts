import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const GET = handle(async () => ({ user: await requireUser() }));
