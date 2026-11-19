// LOOKOUT — Agent 2.5 : Edge Function « recherche-web »
// Recherche générique de produits sur plusieurs sites (Sephora, Notino, Douglas, Ulta…), pour enrichir le marché
// au-delà du panel Circana. L'agent H navigue sur les sites, lit les pages de résultats, puis appelle ces adresses GET :
//   ?action=sites[&zone=EU]                                   -> bibliothèque des sites (table « sites ») + adresse de recherche conseillée
//   ?action=demarrer&requete=blush liquide&zone=EU[&sites=sephora.fr,notino.fr]  -> crée la recherche, renvoie recherche_id + sites à visiter
//   ?action=enregistrer&recherche=<id>&site=sephora.fr&url_recherche=<url>&p=<liste JSON de produits>
//   ?action=signaler&recherche=<id>&site=notino.fr&note=captcha          -> site inaccessible (appris dans la bibliothèque)
//   ?action=terminer&recherche=<id>                                       -> clôture + bilan (marques hors Circana, prix, à enrichir)
//   ?action=voir&recherche=<id>                                           -> produits enregistrés
// Version 7 : l'identifiant de recherche est extrait du paramètre même s'il est entouré de guillemets ou d'espaces.
const ENTETES = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;   // reste côté serveur, jamais renvoyée

// Adresses de recherche conseillées ({q} = mots recherchés). Si la page ne montre pas de résultats,
// l'agent passe par la barre de recherche du site et renvoie l'adresse réellement utilisée (apprise ensuite).
const PAGES_RECHERCHE: Record<string, string> = {
  "sephora.fr": "https://www.sephora.fr/recherche?q={q}",
  "sephora.com": "https://www.sephora.com/search?keyword={q}",
  "ulta.com": "https://www.ulta.com/search?search={q}",
  "nordstrom.com": "https://www.nordstrom.com/sr?keyword={q}",
  "douglas.de": "https://www.douglas.de/de/search?q={q}",
  "notino.fr": "https://www.notino.fr/search.asp?exps={q}",
  "lookfantastic.fr": "https://www.lookfantastic.fr/search?q={q}",
  "boots.com": "https://www.boots.com/sitesearch?searchTerm={q}",
};

const repondre = (corps: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ status, ...corps }, null, 1), { status, headers: ENTETES });

function entetesSb(): Record<string, string> {
  const h: Record<string, string> = { apikey: CLE, "Content-Type": "application/json" };
  if (CLE.startsWith("eyJ")) h.Authorization = `Bearer ${CLE}`;
  return h;
}

async function rpc(nom: string, p: unknown) {
  const res = await fetch(`${URL_SB}/rest/v1/rpc/${nom}`, { method: "POST", headers: entetesSb(), body: JSON.stringify({ p }) });
  const texte = await res.text();
  if (!res.ok) throw new Error(`${nom} -> ${res.status} ${texte.slice(0, 300)}`);
  return JSON.parse(texte) as Record<string, unknown>;
}

async function lire(chemin: string) {
  const res = await fetch(`${URL_SB}/rest/v1/${chemin}`, { headers: entetesSb() });
  const texte = await res.text();
  if (!res.ok) throw new Error(`${chemin} -> ${res.status} ${texte.slice(0, 300)}`);
  return JSON.parse(texte);
}

const pageRecherche = (site: string, consignes: string | null, requete: string) => {
  const modele = PAGES_RECHERCHE[site];
  if (modele) return { adresse: modele.replace("{q}", encodeURIComponent(requete)), origine: "conseillée" };
  const apprise = consignes?.match(/https?:\/\/\S+/)?.[0];
  if (apprise) return { adresse: apprise, origine: "apprise lors d'un passage précédent : remplacer les mots recherchés dans l'adresse" };
  return { adresse: `https://www.${site}/`, origine: "accueil : utiliser la barre de recherche du site" };
};

// Les clés JSON écrites par l'agent peuvent perdre leurs « _ » (rendu Markdown) : on les remet d'aplomb.
const CLES: Record<string, string> = { prixbarre: "prix_barre", nbavis: "nb_avis", nombreavis: "nb_avis", avis: "nb_avis",
  rang: "rang", marque: "marque", brand: "marque", produit: "produit", product: "produit", nom: "produit", prix: "prix", price: "prix",
  devise: "devise", currency: "devise", note: "note", rating: "note", badges: "badges", url: "url", lien: "url", image: "image" };
function normaliserProduit(o: Record<string, unknown>) {
  const sortie: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o ?? {})) {
    const cle = CLES[k.toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "")] ?? k;
    sortie[cle] = v;
  }
  return sortie;
}
const param = (u: URL, ...noms: string[]) => {
  for (const n of noms) { const v = u.searchParams.get(n); if (v !== null && v !== "") return v; }
  return null;
};
// L'agent recopie parfois l'identifiant avec des guillemets (« "a23c…" ») : on n'en garde que l'UUID.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const identifiant = (v: string | null) => (v ? (v.match(UUID)?.[0] ?? v.replace(/["'`\s]/g, "")) : null);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES });
  const url = new URL(req.url);
  const action = param(url, "action");
  const recherche = identifiant(param(url, "recherche", "recherche_id", "rechercheid", "id"));
  try {
    if (action === "sites") {
      const zone = param(url, "zone")?.toUpperCase();
      const sites = await lire(`sites?select=domain,name,zone,country,type,method,cu_instructions,last_success_at&order=zone,domain${zone ? `&zone=eq.${zone}` : ""}`) as
        { domain: string; cu_instructions: string | null }[];
      return repondre({ ok: true, nb_sites: sites.length,
        sites: sites.map((s) => ({ ...s, page_recherche: pageRecherche(s.domain, s.cu_instructions, "blush").adresse })) });
    }

    if (action === "demarrer") {
      const requete = param(url, "requete", "requête", "quete", "requeste", "q", "query", "mots", "keyword", "search") ?? "";
      const sites = param(url, "sites")?.split(",").map((s) => s.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")).filter(Boolean);
      const r = await rpc("web_search_start", { query: requete, zone: param(url, "zone"), category: param(url, "categorie", "category"), sites });
      if (r.ok) {
        type S = { site: string; consignes: string | null };
        r.sites = (r.sites as S[]).map((s) => ({ ...s, page_recherche: pageRecherche(s.site, s.consignes, requete) }));
        r.remplacants = ((r.remplacants ?? []) as S[]).map((s) => ({ ...s, page_recherche: pageRecherche(s.site, s.consignes, requete) }));
        r.suite = "Pour chaque site : ouvrir page_recherche.adresse, relever jusqu'à 10 produits, puis action=enregistrer. Erreur 500 ou page blanche : attendre 20 s et réessayer une fois. Captcha ou accès refusé : action=signaler, puis prendre le site suivant de « remplacants » (6 sites essayés au maximum). À la fin : action=terminer. Recopie recherche_id SANS guillemets.";
      }
      return repondre(r, r.ok ? 200 : 422);
    }

    if (!recherche && ["enregistrer", "signaler", "terminer", "voir"].includes(action ?? ""))
      return repondre({ ok: false, erreur: "Paramètre « recherche » manquant (l'identifiant renvoyé par action=demarrer)." }, 422);

    if (action === "enregistrer") {
      const brut = param(url, "p", "produits");
      if (!brut) return repondre({ ok: false, erreur: "Paramètre « p » manquant : liste JSON des produits relevés." }, 422);
      let donnees: unknown;
      try { donnees = JSON.parse(brut); } catch {
        return repondre({ ok: false, erreur: "« p » n'est pas un JSON valide. Vérifier les guillemets droits \" et les virgules." }, 422);
      }
      const liste = Array.isArray(donnees) ? donnees : (donnees as { produits?: unknown[] })?.produits;
      if (!Array.isArray(liste)) return repondre({ ok: false, erreur: "« p » doit être une liste : [{...}, {...}]" }, 422);
      if (liste.length > 15) return repondre({ ok: false, erreur: `Trop de produits en un appel (${liste.length}) : envoyer par paquets de 10 maximum.` }, 422);
      const r = await rpc("web_listings_save", { search_id: recherche, site: (param(url, "site") ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, ""),
        url_recherche: param(url, "url_recherche", "urlrecherche", "source"), produits: liste.map((o) => normaliserProduit(o as Record<string, unknown>)) });
      return repondre(r, r.ok ? 200 : 422);
    }

    if (action === "signaler") {
      const r = await rpc("web_site_report", { search_id: recherche, site: param(url, "site"), note: param(url, "note", "raison") });
      return repondre(r, r.ok ? 200 : 422);
    }

    if (action === "terminer") {
      const r = await rpc("web_search_finish", { search_id: recherche });
      return repondre(r, r.ok ? 200 : 422);
    }

    if (action === "a_analyser") {   // pour le script « pertinence Linkup » : recherches clôturées pas encore notées
      const tout = ["1", "true", "oui"].includes((param(url, "tout") ?? "").toLowerCase());
      const recherches = await lire(`web_searches?select=id,query,zone,finished_at&status=eq.completed&order=finished_at.desc&limit=20`) as
        { id: string; query: string }[];
      const lots = [];
      for (const s of recherches) {
        if (!tout) {
          const restant = await lire(`web_listings?select=id&search_id=eq.${s.id}&relevance=is.null&limit=1`) as unknown[];
          if (!restant.length) continue;
        }
        lots.push({ search_id: s.id, ...(await rpc("web_search_payload", { search_id: s.id })) });
      }
      return repondre({ ok: true, nb_recherches: lots.length, recherches: lots });
    }

    if (action === "scores" && req.method === "POST") {   // retour du script : scores du modèle Linkup
      const corps = await req.json() as Record<string, unknown>;
      if (!corps?.search_id || !Array.isArray(corps.results)) return repondre({ ok: false, erreur: "Corps attendu : {search_id, results:[...]}" }, 422);
      const maj = await rpc("web_listings_apply_scores", corps);
      const bilan = await rpc("web_search_finish", { search_id: corps.search_id });
      return repondre({ ok: true, ...maj, bilan: (bilan as { bilan?: unknown }).bilan });
    }

    if (action === "voir") {
      const lignes = await lire(`web_listings?search_id=eq.${encodeURIComponent(recherche!)}&select=site,rank,brand,product_name,price,currency,rating,review_count,badges,brand_in_circana,product_url&order=site,rank`);
      return repondre({ ok: true, nb_produits: lignes.length, produits: lignes });
    }

    return repondre({ ok: true, aide: {
      sites: "?action=sites&zone=EU",
      demarrer: "?action=demarrer&requete=blush liquide&zone=EU[&sites=sephora.fr,notino.fr]",
      enregistrer: "?action=enregistrer&recherche=<id>&site=sephora.fr&url_recherche=<adresse>&p=[{\"rang\":1,\"marque\":\"..\",\"produit\":\"..\",\"prix\":29.9,\"devise\":\"EUR\",\"note\":4.6,\"nb_avis\":812,\"badges\":[\"Nouveauté\"],\"url\":\"https://..\",\"image\":\"https://..\"}]",
      signaler: "?action=signaler&recherche=<id>&site=notino.fr&note=captcha",
      terminer: "?action=terminer&recherche=<id>", voir: "?action=voir&recherche=<id>" } });
  } catch (erreur) {
    return repondre({ ok: false, erreur: String((erreur as Error).message ?? erreur).slice(0, 2000) }, 500);
  }
});
