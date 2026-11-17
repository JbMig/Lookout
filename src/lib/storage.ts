import "server-only";
import { createClient } from "@supabase/supabase-js";
import { config, isDemo } from "./config";

/** Dépose un fichier dans un bucket Supabase Storage existant. Renvoie le chemin, ou null en mode démo. */
export async function uploadToBucket(bucket: string, path: string, body: ArrayBuffer, contentType: string): Promise<string | null> {
  if (isDemo.db) return null;
  const sb = createClient(config.supabase.url, config.supabase.serviceKey, { auth: { persistSession: false } });
  const { error } = await sb.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (error) {
    console.error("storage", bucket, error.message);
    return null;
  }
  return `${bucket}/${path}`;
}
