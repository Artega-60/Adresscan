"use client";

import { useState } from "react";

interface Rapport {
  adresse: {
    label: string;
    city: string;
    postcode: string;
  };
  risques: {
    inondation: "present" | "non_recense" | "indisponible";
    argiles: "bientot_disponible";
    sismicite: string | null;
    radon: string | null;
    autresRisques: string[];
  };
  marche: {
    prixMoyenM2: number | null;
    nbTransactions: number;
    comparables: {
      adresse: string;
      surface: number | null;
      prix: number;
      prixM2: number | null;
      date: string;
    }[];
    erreur: string | null;
  };
}

const LABELS_INONDATION: Record<string, string> = {
  present: "Risque recensé",
  non_recense: "Non recensé",
  indisponible: "Donnée indisponible",
};

function Tampon({ statut }: { statut: "present" | "non_recense" | "indisponible" }) {
  const couleur =
    statut === "present"
      ? "var(--ocre-cadastre)"
      : statut === "non_recense"
      ? "var(--vert-cadastre)"
      : "var(--trait)";

  return (
    <div
      className="inline-flex flex-col items-center justify-center shrink-0"
      style={{
        border: `2px solid ${couleur}`,
        color: couleur,
        transform: "rotate(-3deg)",
        padding: "10px 14px",
        borderRadius: "3px",
        fontFamily: "var(--font-mono-data)",
      }}
    >
      <span className="text-[10px] tracking-wide leading-none mb-1">Inondation</span>
      <span className="text-xs font-medium leading-none">
        {LABELS_INONDATION[statut]}
      </span>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setRapport(null);

    try {
      const res = await fetch(`/api/rapport?adresse=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erreur lors de la recherche");
      }
      const data = await res.json();
      setRapport(data);
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--papier)" }}>
      {/* Bandeau encre */}
      <div style={{ background: "var(--encre)" }} className="px-4 py-10">
        <div className="max-w-xl mx-auto">
          <h1
            className="text-3xl text-center mb-1"
            style={{ fontFamily: "var(--font-display)", color: "var(--papier-clair)" }}
          >
            Adresscan
          </h1>
          <p
            className="text-sm text-center mb-6"
            style={{ color: "var(--trait)" }}
          >
            Risques naturels et prix du marché, pour n&apos;importe quelle adresse en France
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="12 rue de la Paix, Paris"
              className="flex-1 px-3 py-2.5 text-sm outline-none"
              style={{
                background: "var(--papier-clair)",
                color: "var(--encre)",
                border: "1px solid var(--trait)",
                borderRadius: "2px",
                fontFamily: "var(--font-mono-data)",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="text-sm px-5 py-2.5 disabled:opacity-50"
              style={{
                background: "var(--ocre-cadastre)",
                color: "var(--papier-clair)",
                borderRadius: "2px",
                fontFamily: "var(--font-display)",
              }}
            >
              {loading ? "Recherche…" : "Analyser"}
            </button>
          </form>
        </div>
      </div>

      {/* Contenu rapport */}
      <div className="max-w-xl mx-auto px-4 py-8">
        {error && (
          <p
            className="text-sm mb-6"
            style={{ color: "#A23E33", fontFamily: "var(--font-mono-data)" }}
          >
            {error}
          </p>
        )}

        {rapport && (
          <div>
            {/* En-tête adresse */}
            <div
              className="flex items-start justify-between gap-4 pb-5 mb-5"
              style={{ borderBottom: "1px solid var(--trait)" }}
            >
              <div>
                <p className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
                  {rapport.adresse.label}
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--encre-clair)", fontFamily: "var(--font-mono-data)" }}
                >
                  {rapport.adresse.postcode} {rapport.adresse.city}
                </p>
              </div>
              <Tampon statut={rapport.risques.inondation} />
            </div>

            {/* Section risques */}
            <section className="mb-8">
              <h2
                className="text-sm mb-3"
                style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
              >
                Risques et environnement
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <p className="text-xs mb-1" style={{ color: "var(--encre-clair)" }}>
                    Argiles (retrait-gonflement)
                  </p>
                  <p style={{ fontFamily: "var(--font-mono-data)", color: "var(--encre-clair)" }}>
                    Bientôt disponible
                  </p>
                </div>
                {rapport.risques.sismicite && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--encre-clair)" }}>
                      Sismicité
                    </p>
                    <p style={{ fontFamily: "var(--font-mono-data)" }}>
                      {rapport.risques.sismicite}
                    </p>
                  </div>
                )}
              </div>
              {rapport.risques.autresRisques.length > 0 && (
                <p
                  className="text-xs"
                  style={{ color: "var(--encre-clair)", fontFamily: "var(--font-mono-data)" }}
                >
                  Autres risques recensés sur la commune : {rapport.risques.autresRisques.join(", ")}
                </p>
              )}
            </section>

            {/* Emplacement publicitaire */}
            <div
              className="mb-8 px-4 py-3 flex items-center justify-between text-xs"
              style={{
                border: "1px dashed var(--trait)",
                color: "var(--encre-clair)",
                fontFamily: "var(--font-mono-data)",
              }}
            >
              <span>Publicité</span>
              <span>emplacement natif</span>
            </div>

            {/* Section marché */}
            <section className="mb-8">
              <h2
                className="text-sm mb-3"
                style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
              >
                Prix et marché
              </h2>

              {rapport.marche.erreur ? (
                <p
                  className="text-sm mb-3"
                  style={{ color: "#A23E33", fontFamily: "var(--font-mono-data)" }}
                >
                  {rapport.marche.erreur}
                </p>
              ) : rapport.marche.prixMoyenM2 ? (
                <p
                  className="text-3xl mb-4"
                  style={{ fontFamily: "var(--font-mono-data)" }}
                >
                  {rapport.marche.prixMoyenM2.toLocaleString("fr-FR")}
                  <span className="text-sm ml-1" style={{ color: "var(--encre-clair)" }}>
                    €/m²
                  </span>
                </p>
              ) : (
                <p
                  className="text-sm mb-3"
                  style={{ color: "var(--encre-clair)", fontFamily: "var(--font-mono-data)" }}
                >
                  Pas assez de transactions récentes pour estimer un prix moyen
                </p>
              )}

              {rapport.marche.comparables.length > 0 && (
                <div>
                  <p
                    className="text-xs mb-2"
                    style={{ color: "var(--encre-clair)" }}
                  >
                    Transactions comparables
                  </p>
                  <table
                    className="w-full text-sm"
                    style={{ fontFamily: "var(--font-mono-data)" }}
                  >
                    <tbody>
                      {rapport.marche.comparables.slice(0, 5).map((c, i) => (
                        <tr
                          key={i}
                          style={{ borderTop: "1px solid var(--trait)" }}
                        >
                          <td className="py-2 pr-2" style={{ color: "var(--encre-clair)" }}>
                            {c.adresse || "—"}
                          </td>
                          <td className="py-2 pr-2 text-right whitespace-nowrap">
                            {c.surface ?? "—"} m²
                          </td>
                          <td className="py-2 text-right whitespace-nowrap font-medium">
                            {c.prix.toLocaleString("fr-FR")} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
