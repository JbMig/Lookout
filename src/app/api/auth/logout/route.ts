import { handle } from "@/lib/http";
import { logout } from "@/lib/auth";

export const POST = handle(async () => {
  await logout();
  return { ok: true };
});
