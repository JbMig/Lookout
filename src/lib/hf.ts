import { config, isDemo } from "./config";

/**
 * Appel à un LLM open source hébergé via Hugging Face Inference Providers
 * (point d'accès compatible OpenAI). Renvoie null en mode démo ou en cas d'échec,
 * pour que l'appelant utilise son texte de secours.
 */
export async function chat(system: string, user: string, maxTokens = 700): Promise<string | null> {
  if (isDemo.hf) return null;
  try {
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.hf.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.hf.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("Hugging Face", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("Hugging Face", e);
    return null;
  }
}
