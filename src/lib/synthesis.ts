/**
 * Découpe une synthèse rédigée par l'Agent 3 (un seul paragraphe) en blocs lisibles :
 * contexte, détail du périmètre, constats numérotés, remarques finales.
 * Pur : utilisé dans le navigateur et testé.
 */
export interface SynthesisParts {
  lead: string;
  scope: string | null;
  findings: string[];
  notes: string[];
}

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/\s*[;,]\s*$/, "").trim();
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const end = (s: string) => (/[.!?)]$/.test(s) ? s : `${s}.`);

/** Phrases d'un texte (coupe après . ! ? suivis d'une majuscule). */
export function sentences(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9])/)) {
    // « min. 34 USD », « env. 5 % » : une abréviation ne termine pas la phrase.
    if (out.length && /\b(min|max|env|ex|vs|cf|approx|réf|ref)\.$/i.test(out[out.length - 1])) out[out.length - 1] += ` ${part}`;
    else out.push(part);
  }
  return out.map(clean).filter(Boolean);
}

/** Retire la première parenthèse longue de la phrase d'introduction et la renvoie à part. */
function splitScope(lead: string): { lead: string; scope: string | null } {
  const m = lead.match(/\s*\(([^()]{25,})\)/);
  if (!m) return { lead, scope: null };
  return { lead: clean(lead.replace(m[0], "")), scope: cap(clean(m[1].replace(/^catalogue\s*:\s*/i, ""))) };
}

export function parseSynthesis(text: string | null | undefined): SynthesisParts {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { lead: "", scope: null, findings: [], notes: [] };

  const marker = t.search(/\(1\)/);
  if (marker < 0) {
    const [first = "", ...rest] = sentences(t);
    const { lead, scope } = splitScope(first);
    return { lead: end(lead), scope, findings: [], notes: rest.map(end) };
  }

  let intro = t.slice(0, marker).replace(/\b(constats?|observations?|points?)\s*:\s*$/i, "").trim();
  const body = t.slice(marker);
  const items = body.split(/\(\d+\)\s*/).map((s) => s.trim()).filter(Boolean);

  // La dernière ligne numérotée peut être suivie de phrases de conclusion.
  const notes: string[] = [];
  if (items.length) {
    const [last, ...after] = sentences(items[items.length - 1]);
    items[items.length - 1] = last ?? "";
    notes.push(...after);
  }
  const introSentences = sentences(intro);
  intro = introSentences[0] ?? "";
  const { lead, scope } = splitScope(intro);
  return {
    lead: end(lead),
    scope,
    findings: items.map((i) => cap(clean(i))).filter(Boolean),
    notes: [...introSentences.slice(1), ...notes].map((n) => end(cap(n))),
  };
}
