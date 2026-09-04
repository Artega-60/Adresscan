import { NextRequest, NextResponse } from "next/server";

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

interface RisqueSection {
  inondation: "faible" | "moyen" | "eleve" | "inconnu";
  argiles: "faible" | "moyen" | "eleve" | "inconnu";
  sismicite: string | null;
  radon: string | null;
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

    // NOTE: la structure exacte de la réponse Géorisques varie selon les
    // couches (argiles, inondation, sismicité, radon). À affiner une fois
    // qu'on a un exemple de réponse réelle sous les yeux.
    return {
      inondation: data?.inondation ?? "inconnu",
      argiles: data?.argiles ?? "inconnu",
      sismicite: data?.sismicite ?? null,
      radon: data?.radon ?? null,
    };
  } catch {
    return {
      inondation: "inconnu",
      argiles: "inconnu",
      sismicite: null,
      radon: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Étape 3 — transactions comparables via DVF (data.gouv.fr)
// On utilise l'API DVF de data.gouv (app.dvf.etalab.gouv.fr ou api.cquest.org
// selon disponibilité) filtrée par code commune (citycode).
// ---------------------------------------------------------------------------

async function getMarche(citycode: string) {
  try {
    const url = `https://api.dvf.etalab.gouv.fr/dvf?code_commune=${citycode}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("DVF indisponible");
    const data = await res.json();

    const ventes = (data?.resultats ?? [])
      .filter((v: any) => v.valeur_fonciere && v.surface_relle_bati)
      .slice(0, 10)
      .map((v: any) => ({
        adresse: `${v.adresse_numero ?? ""} ${v.adresse_nom_voie ?? ""}`.trim(),
        surface: v.surface_relle_bati ?? null,
        prix: v.valeur_fonciere,
        prixM2: v.surface_relle_bati
          ? Math.round(v.valeur_fonciere / v.surface_relle_bati)
          : null,
        date: v.date_mutation,
      })) as TransactionComparable[];

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
    };
  } catch {
    return { prixMoyenM2: null, nbTransactions: 0, comparables: [] };
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
