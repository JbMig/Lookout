// LOOKOUT — Agent 1 : Edge Function « import-circana »
// Appelée par l'agent H (navigateur cloud) avec de simples adresses GET, comme save-product :
//   ?action=liste                      -> fichiers déposés dans le bucket circana-uploads + statut (importé / à importer / doublon)
//   ?action=importer_tout              -> importe en un seul appel TOUS les fichiers à importer (aucun nom à recopier)
//   ?fichier=<nom>[&force=1]           -> importe un fichier précis (nom tolérant : espaces / _ / - / majuscules)
//      options CSV : &categorie=blush&periodes=FY%202024,FY%202025
//   ?action=verifier                   -> derniers imports : lignes annoncées vs lignes réellement en base
// Réponse toujours en JSON avec "ok" et "status" (succès = ok:true et status:200).
//
// Version 6 :
// - les dossiers du bucket (ex. anciens dépôts rangés par utilisateur) ne sont plus pris pour des fichiers ;
// - un fichier redéposé à l'identique (même nom sans le préfixe de date AAAAMMJJHHMM_ et même taille qu'un fichier
//   déjà importé) est marqué « doublon » et n'est pas réimporté, sauf avec &force=1 : sinon les ventes seraient comptées deux fois.
import * as XLSX from "npm:xlsx@0.18.5";
import { annee, controler, lignesVentes, lireClasseur, lireCsv, sansAccents } from "./parser.ts";

const BUCKET = "circana-uploads";
const ENTETES = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;      // reste côté serveur, jamais renvoyée

const repondre = (corps: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ status, ...corps }, null, 1), { status, headers: ENTETES });

function entetesSb(extra: Record<string, string> = {}) {
  const h: Record<string, string> = { apikey: CLE, "Content-Type": "application/json", ...extra };
  if (CLE.startsWith("eyJ")) h.Authorization = `Bearer ${CLE}`;  // ancienne clé JWT
  return h;
}

async function sb(chemin: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_SB}${chemin}`, { ...init, headers: { ...entetesSb(), ...(init.headers ?? {}) } });
  const texte = await res.text();
  let corps: unknown = texte;
  try { corps = JSON.parse(texte); } catch { /* texte brut */ }
  if (!res.ok) throw new Error(`${chemin} -> ${res.status} ${texte.slice(0, 300)}`);
  return corps;
}

/** Nom sans le préfixe de date ajouté au dépôt par le site (« 202611191912_Benchmark.xlsx » -> « benchmark.xlsx »). */
const nomDeBase = (n: string) => (n.split("/").pop() ?? n).replace(/^\d{12}_/, "").toLowerCase();

type Fichier = { fichier: string; depose_le: string; taille_octets: number | null; statut: "importe" | "a_importer" | "doublon";
  import_id: string | null; lignes: number | null; doublon_de?: string };

async function listerFichiers(): Promise<Fichier[]> {
  const brut = await sb(`/storage/v1/object/list/${BUCKET}`, {
    method: "POST", body: JSON.stringify({ prefix: "", limit: 100, sortBy: { column: "created_at", order: "desc" } }),
  }) as { id: string | null; name: string; created_at: string; metadata?: { size?: number } | null }[];
  // Un dossier est renvoyé sans id ni métadonnées : ce n'est pas un fichier à importer.
  const fichiers = brut.filter((f) => f.id && f.name && !f.name.endsWith("/") && f.name !== ".emptyFolderPlaceholder");
  const imports = await sb(`/rest/v1/circana_imports?select=id,filename,storage_path,status,row_count,created_at&order=created_at.desc&limit=200`) as
    { id: string; filename: string; storage_path: string | null; status: string; row_count: number; created_at: string }[];
  const faits = imports.filter((i) => i.status === "completed");
  const liste: Fichier[] = fichiers.map((f) => {
    const fait = faits.find((i) => i.storage_path === f.name || i.filename === f.name);
    return { fichier: f.name, depose_le: f.created_at, taille_octets: f.metadata?.size ?? null,
      statut: fait ? "importe" : "a_importer", import_id: fait?.id ?? null, lignes: fait?.row_count ?? null };
  });
  for (const f of liste) {
    if (f.statut !== "a_importer") continue;
    const jumeau = liste.find((g) => g.statut === "importe" && g.fichier !== f.fichier
      && nomDeBase(g.fichier) === nomDeBase(f.fichier) && g.taille_octets !== null && g.taille_octets === f.taille_octets);
    if (jumeau) { f.statut = "doublon"; f.doublon_de = jumeau.fichier; f.import_id = jumeau.import_id; f.lignes = jumeau.lignes; }
  }
  return liste;
}

const simplifier = (n: string) => sansAccents(n).toLowerCase().replace(/[\s_\-.]+/g, "");

async function resoudreNom(demande: string): Promise<Fichier> {
  const fichiers = await listerFichiers();
  const exact = fichiers.find((f) => f.fichier === demande);
  if (exact) return exact;
  const proches = fichiers.filter((f) => simplifier(f.fichier) === simplifier(demande));
  if (proches.length === 1) return proches[0];          // ex. « Benchmark test.xlsx » -> « Benchmark_test.xlsx »
  throw new Error(`Fichier introuvable dans ${BUCKET} : « ${demande} ». Fichiers disponibles : ${fichiers.map((f) => f.fichier).join(", ") || "aucun"}`);
}

async function noterEchec(nom: string, message: string) {
  await sb(`/rest/v1/circana_imports`, { method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ filename: nom.split("/").pop(), storage_path: nom, status: "failed", error_message: message.slice(0, 2000) }) })
    .catch(() => null);
}

async function importerTout(categorie: string | null, periodes: string[] | null) {
  const liste = await listerFichiers();
  const aFaire = liste.filter((f) => f.statut === "a_importer").map((f) => f.fichier);
  const doublons = liste.filter((f) => f.statut === "doublon").map((f) => ({ fichier: f.fichier, doublon_de: f.doublon_de }));
  const resultats = [];
  for (const nom of aFaire) {
    try { resultats.push(await importer(nom, false, categorie, periodes)); }
    catch (erreur) {
      const message = String((erreur as Error).message ?? erreur);
      await noterEchec(nom, message);
      resultats.push({ ok: false, fichier: nom, erreur: message });
    }
  }
  return { ok: resultats.every((r) => (r as { ok?: boolean }).ok !== false), nb_fichiers_traites: aFaire.length,
    nb_reussis: resultats.filter((r) => (r as { ok?: boolean }).ok !== false).length,
    message: aFaire.length ? undefined : "Aucun fichier à importer.", doublons_ignores: doublons, resultats };
}

async function importer(nom: string, force: boolean, categorie: string | null, periodes: string[] | null) {
  const res = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${encodeURIComponent(nom).replace(/%2F/g, "/")}`, { headers: entetesSb() });
  if (!res.ok) throw new Error(`Téléchargement impossible depuis ${BUCKET} : « ${nom} » (${res.status} ${(await res.text()).slice(0, 150)})`);
  const octets = new Uint8Array(await res.arrayBuffer());
  const estCsv = /\.(csv|txt)$/i.test(nom);
  const { skus, meta } = estCsv ? lireCsv(new TextDecoder("utf-8").decode(octets)) : lireClasseur(XLSX, octets);
  if (categorie) meta.categorie = categorie;
  if (periodes?.length === 2) { meta.periode_n1 = periodes[0]; meta.periode_n = periodes[1]; }
  if (!skus.length) throw new Error("Aucune ligne SKU reconnue dans le fichier (onglets « Top 50 SKU » ou CSV à plat attendus).");
  const alertes = controler(skus);
  const lignes = lignesVentes(skus, meta);
  const resultat = await sb(`/rest/v1/rpc/import_circana`, {
    method: "POST",
    body: JSON.stringify({ p: {
      filename: nom.split("/").pop(), storage_path: nom, force,
      period_start: `${annee(meta.periode_n1)}-01-01`, period_end: `${annee(meta.periode_n)}-12-31`,
      alertes: alertes.length ? ("Alertes : " + alertes.join(" | ")).slice(0, 2000) : "", rows: lignes,
    } }),
  }) as Record<string, unknown>;
  const totaux: Record<string, number> = {};             // contrôle : CA du top de la dernière année, par pays
  for (const l of lignes) if (l.period.startsWith(String(annee(meta.periode_n)))) {
    const k = `${l.country} (${l.currency})`; totaux[k] = (totaux[k] ?? 0) + l.revenue;
  }
  const controleCa = Object.fromEntries(Object.entries(totaux).map(([k, v]) => [k, `${(v / 1e6).toFixed(2)} M`]));
  return { ...resultat, fichier: nom, categorie: meta.categorie, periodes: [meta.periode_n1, meta.periode_n],
    skus_lus: skus.length, lignes_envoyees: lignes.length, alertes, ca_top_derniere_annee: controleCa };
}

async function verifier() {
  const imports = await sb(`/rest/v1/circana_imports?select=id,filename,status,row_count,error_message,created_at&order=created_at.desc&limit=10`) as
    { id: string; filename: string; status: string; row_count: number; error_message: string | null; created_at: string }[];
  const resultats = [];
  for (const i of imports) {
    const res = await fetch(`${URL_SB}/rest/v1/circana_sales?select=id&import_id=eq.${i.id}`,
      { method: "HEAD", headers: entetesSb({ Prefer: "count=exact" }) });
    const reel = Number(res.headers.get("content-range")?.split("/")[1] ?? NaN);
    resultats.push({ ...i, lignes_en_base: reel, coherent: i.status !== "completed" || reel === i.row_count });
  }
  return { imports: resultats, tout_est_coherent: resultats.every((r) => r.coherent) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES });
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const fichier = url.searchParams.get("fichier");
  try {
    if (action === "liste") {
      const fichiers = await listerFichiers();
      return repondre({ ok: true, bucket: BUCKET, nb_fichiers: fichiers.length,
        a_importer: fichiers.filter((f) => f.statut === "a_importer").map((f) => f.fichier),
        doublons: fichiers.filter((f) => f.statut === "doublon").map((f) => ({ fichier: f.fichier, doublon_de: f.doublon_de })), fichiers });
    }
    if (action === "verifier") return repondre({ ok: true, ...(await verifier()) });
    const periodes = url.searchParams.get("periodes")?.split(",").map((s) => s.trim()) ?? null;
    if (action === "importer_tout") {
      const bilan = await importerTout(url.searchParams.get("categorie"), periodes);
      return repondre(bilan, bilan.ok ? 200 : 207);
    }
    if (fichier) {
      const force = ["1", "true", "oui"].includes((url.searchParams.get("force") ?? "").toLowerCase());
      let nom = fichier;
      try {
        const f = await resoudreNom(fichier);
        nom = f.fichier;
        if (f.statut === "doublon" && !force) {
          return repondre({ ok: true, statut: "deja_importe", fichier: nom, doublon_de: f.doublon_de, import_id: f.import_id, lignes: f.lignes,
            note: "Fichier identique à un fichier déjà importé (même nom et même taille) : rien n'a été modifié. Ajoute &force=1 pour le réimporter quand même." });
        }
        return repondre({ ...(await importer(nom, force, url.searchParams.get("categorie"), periodes)),
          ...(nom !== fichier ? { nom_demande: fichier, nom_corrige: nom } : {}) });
      } catch (erreur) {
        const message = String((erreur as Error).message ?? erreur).slice(0, 2000);
        await noterEchec(nom, message);
        return repondre({ ok: false, fichier: nom, erreur: message,
          note: "Aucune vente n'a été modifiée ; l'échec est noté dans circana_imports (status = failed)." }, 422);
      }
    }
    return repondre({ ok: true, aide: {
      liste: "?action=liste", importer_tout: "?action=importer_tout",
      importer_un_fichier: "?fichier=<nom du fichier dans circana-uploads>[&force=1]",
      csv: "&categorie=blush&periodes=FY 2024,FY 2025", verifier: "?action=verifier" } });
  } catch (erreur) {
    return repondre({ ok: false, erreur: String((erreur as Error).message ?? erreur).slice(0, 2000) }, 500);
  }
});
