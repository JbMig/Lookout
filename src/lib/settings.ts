import "server-only";
import { createClient } from "@supabase/supabase-js";
import { config, isDemo } from "./config";
import { repo } from "./repo";
import type { Format } from "./normalize";

/** Configuration des agents, saisie sur /settings (table app_settings, clé « agent_config »). */
export interface AgentConfig {
  brand: string;
  zone: "US" | "FR" | "EU";
  category: string;
  formats: Format[];
  startUrl: string;
}

export const DEFAULT_CONFIG: AgentConfig = { brand: "", zone: "US", category: "blush", formats: [], startUrl: "" };

const sb = () => createClient(config.supabase.url, config.supabase.serviceKey, { auth: { persistSession: false } });

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (isDemo.db) {
    const row = await repo().get<{ id: string; value: T }>("app_settings", key);
    return row?.value ?? fallback;
  }
  const { data, error } = await sb().from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`app_settings: ${error.message}`);
  return (data?.value as T) ?? fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  if (isDemo.db) {
    const exists = await repo().get("app_settings", key);
    if (exists) await repo().update("app_settings", key, { value });
    else await repo().insert("app_settings", [{ id: key, key, value } as never]);
    return;
  }
  const { error } = await sb().from("app_settings").upsert({ key, value: value as object }, { onConflict: "key" });
  if (error) throw new Error(`app_settings: ${error.message}`);
}

export async function getAgentConfig(): Promise<AgentConfig> {
  return { ...DEFAULT_CONFIG, ...(await getSetting<Partial<AgentConfig>>("agent_config", {})) };
}
