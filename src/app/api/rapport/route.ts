import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeocodeResult {
  label: string;
  city: string;
  postcode: string;
  citycode: string; // code INSEE, needed for DVF lookups
  lat: number;
  lon: number;
}

// Statut simple par risque : Géorisques (couche GASPAR) nous dit seulement si
// un risque est recensé sur la commune, pas un niveau détaillé par adresse.
type StatutRisque = "present" | "non_recense" | "indisponible";

interface RisqueSection {
  inondation: StatutRisque;
  argiles: "bientot_disponible"; // nécessite une couche géospatiale séparée (RGA/BRGM), pas encore branchée
  sismicite: string | null;
  radon: string | null;
  autresRisques: string[]; // tous les autres risques recensés sur la commune, pour info
}

interface TransactionComparable {
  adresse: string;
  surface: number | null;
  prix: number;
  prixM2: number | null;
  date: string;
}

interface Rapport {
  adresse: GeocodeResult;
  risques: RisqueSection;
  marche: {
    prixMoyenM2: number | null;
    nbTransactions: number;
    comparables: TransactionComparable[];
    erreur: string | null;
  };
}

// ---------------------------------------------------------------------------
// Étape 1 — géocodage via l'API Adresse (BAN, data.gouv.fr)
// Doc: https://adresse.data.gouv.fr/api-doc/adresse
// ---------------------------------------------------------------------------

async function geocode(query: string): Promise<GeocodeResult | null> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(
    query
  )}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  const props = feature.properties;

  return {
    label: props.label,
    city: props.city,
    postcode: props.postcode,
    citycode: props.citycode,
    lat,
    lon,
  };
}

// ---------------------------------------------------------------------------
// Étape 2 — risques naturels via l'API Géorisques
// Doc: https://www.georisques.gouv.fr/doc-api
// (Endpoint simplifié — à ajuster une fois la clé/quota validés côté Géorisques)
// ---------------------------------------------------------------------------

async function getRisques(lat: number, lon: number): Promise<RisqueSection> {
  try {
    const url = `https://www.georisques.gouv.fr/api/v1/gaspar/risques?latlon=${lon},${lat}&rayon=1000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Géorisques indisponible");
    const data = await res.json();

    // Structure réelle confirmée : data.data[0].risques_detail est un tableau
    // de { num_risque, libelle_risque_long } recensés au niveau de la commune.
    const detail: { libelle_risque_long: string }[] =
      data?.data?.[0]?.risques_detail ?? [];

    const libelles = detail.map((r) => r.libelle_risque_long);

    const inondation: StatutRisque = libelles.some((l) =>
      l.toLowerCase().includes("inondation")
    )
      ? "present"
      : "non_recense";

    const sismicite = detail.find((r) =>
      r.libelle_risque_long.toLowerCase().includes("sism")
    )?.libelle_risque_long ?? null;

    const radon = detail.find((r) =>
      r.libelle_risque_long.toLowerCase().includes("radon")
    )?.libelle_risque_long ?? null;

    // Le reste des risques recensés (hors inondation/sismicité/radon déjà extraits)
    const autresRisques = libelles.filter(
      (l) =>
        !l.toLowerCase().includes("inondation") &&
        !l.toLowerCase().includes("sism") &&
        !l.toLowerCase().includes("radon")
    );

    return { inondation, argiles: "bientot_disponible", sismicite, radon, autresRisques };
  } catch {
    return {
      inondation: "indisponible",
      argiles: "bientot_disponible",
      sismicite: null,
      radon: null,
      autresRisques: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Étape 3 — transactions comparables via NOTRE base Supabase
//
// Les données DVF sont importées à l'avance dans la table `dvf_transactions`
// (voir procédure d'import département par département). On interroge notre
// propre base plutôt qu'une API externe tierce, pour la fiabilité.
// ---------------------------------------------------------------------------

async function getMarche(citycode: string) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("dvf_transactions")
      .select(
        "adresse_numero, adresse_nom_voie, valeur_fonciere, surface_reelle_bati, date_mutation, type_local"
      )
      .eq("code_commune", citycode)
      .eq("nature_mutation", "Vente")
      .in("type_local", ["Appartement", "Maison"]) // exclut locaux commerciaux, terrains, etc.
      .not("valeur_fonciere", "is", null)
      .not("surface_reelle_bati", "is", null)
      .gt("surface_reelle_bati", 9) // exclut les micro-surfaces probablement mal saisies
      .lt("surface_reelle_bati", 400) // exclut les surfaces aberrantes pour du résidentiel
      .order("date_mutation", { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message);

    const ventes: TransactionComparable[] = (data ?? []).map((v) => ({
      adresse: `${v.adresse_numero ?? ""} ${v.adresse_nom_voie ?? ""}`.trim(),
      surface: v.surface_reelle_bati,
      prix: v.valeur_fonciere,
      prixM2: Math.round(v.valeur_fonciere / v.surface_reelle_bati),
      date: v.date_mutation,
    }));

    const prixM2Valides = ventes
      .map((v) => v.prixM2)
      .filter((p): p is number => p !== null);

    const prixMoyenM2 =
      prixM2Valides.length > 0
        ? Math.round(
            prixM2Valides.reduce((a, b) => a + b, 0) / prixM2Valides.length
          )
        : null;

    return {
      prixMoyenM2,
      nbTransactions: ventes.length,
      comparables: ventes,
      erreur:
        ventes.length === 0
          ? "Aucune transaction importée pour cette commune pour l'instant"
          : null,
    };
  } catch (e: any) {
    return {
      prixMoyenM2: null,
      nbTransactions: 0,
      comparables: [],
      erreur: e?.message ?? "Erreur inconnue lors de la lecture Supabase",
    };
  }
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("adresse");
  if (!q) {
    return NextResponse.json(
      { error: "Paramètre 'adresse' manquant" },
      { status: 400 }
    );
  }

  const adresse = await geocode(q);
  if (!adresse) {
    return NextResponse.json(
      { error: "Adresse introuvable" },
      { status: 404 }
    );
  }

  const [risques, marche] = await Promise.all([
    getRisques(adresse.lat, adresse.lon),
    getMarche(adresse.citycode),
  ]);

  const rapport: Rapport = { adresse, risques, marche };

  return NextResponse.json(rapport);
}
