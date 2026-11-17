/**
 * Configuration centralisée. Chaque service bascule en « mode démo »
 * (données fictives) tant que sa clé n'est pas renseignée.
 */
export const config = {
  supabase: {
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  linkup: {
    apiKey: process.env.LINKUP_API_KEY ?? "",
    depth: (process.env.LINKUP_DEPTH ?? "standard") as "fast" | "standard" | "deep",
  },
  hcompany: {
    apiKey: process.env.HAI_API_KEY ?? "",
    baseUrl: process.env.HAI_BASE_URL ?? "https://agp.eu.hcompany.ai/api/v2",
    agent: process.env.HAI_AGENT ?? "h/web-surfer-flash",
    maxTimeS: Number(process.env.HAI_MAX_TIME_S ?? 300),
  },
  hf: {
    token: process.env.HF_TOKEN ?? "",
    model: process.env.HF_MODEL ?? "Qwen/Qwen2.5-72B-Instruct",
    embeddingModel: process.env.HF_EMBEDDING_MODEL ?? "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    trendsDataset: process.env.HF_TRENDS_DATASET ?? "",
    trendsConfig: process.env.HF_TRENDS_CONFIG ?? "default",
    trendsSplit: process.env.HF_TRENDS_SPLIT ?? "train",
  },
  /** E-mails des membres de l'équipe Lookout (accès à l'administration). */
  staffEmails: (process.env.STAFF_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};

/**
 * Connexion en un clic au compte de démonstration.
 * Toujours active sans Supabase ; avec Supabase, il faut DEMO_LOGIN=true et DEMO_PASSWORD.
 */
export const demoLogin = {
  email: (process.env.DEMO_EMAIL ?? "demo@lookout.app").toLowerCase(),
  password: process.env.DEMO_PASSWORD ?? "",
  forced: process.env.DEMO_LOGIN === "true",
};

export const isDemo = {
  db: !config.supabase.url || !config.supabase.serviceKey || !config.supabase.anonKey,
  linkup: !config.linkup.apiKey,
  hcompany: !config.hcompany.apiKey,
  hf: !config.hf.token,
};
