"use client";

import { useState } from "react";

interface Rapport {
  adresse: {
    label: string;
    city: string;
    postcode: string;
  };
  risques: {
    inondation: string;
    argiles: string;
    sismicite: string | null;
    radon: string | null;
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
  };
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
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-xl font-medium mb-2 text-center">Adresscan</h1>
      <p className="text-sm text-neutral-500 mb-6 text-center">
        Risques naturels et prix du marché pour n&apos;importe quelle adresse en France
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="12 rue de la Paix, Paris"
          className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-neutral-900 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
        >
          {loading ? "Recherche…" : "Analyser"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-6">{error}</p>}

      {rapport && (
        <div className="space-y-4">
          <div className="border border-neutral-200 rounded-lg p-4">
            <p className="font-medium">{rapport.adresse.label}</p>
            <p className="text-sm text-neutral-500">
              {rapport.adresse.postcode} {rapport.adresse.city}
            </p>
          </div>

          <div className="border border-neutral-200 rounded-lg p-4">
            <p className="font-medium text-sm mb-3">Risques et environnement</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-neutral-500 text-xs">Inondation</p>
                <p className="capitalize">{rapport.risques.inondation}</p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Argiles</p>
                <p className="capitalize">{rapport.risques.argiles}</p>
              </div>
            </div>
          </div>

          <div className="border border-neutral-200 rounded-lg p-4">
            <p className="font-medium text-sm mb-3">Prix et marché</p>
            {rapport.marche.prixMoyenM2 ? (
              <p className="text-2xl font-medium mb-3">
                {rapport.marche.prixMoyenM2.toLocaleString("fr-FR")} €/m²
              </p>
            ) : (
              <p className="text-sm text-neutral-500 mb-3">
                Pas assez de données locales pour estimer un prix moyen
              </p>
            )}

            {rapport.marche.comparables.length > 0 && (
              <table className="w-full text-sm">
                <tbody>
                  {rapport.marche.comparables.slice(0, 5).map((c, i) => (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className="py-1.5 text-neutral-500">{c.adresse || "—"}</td>
                      <td className="py-1.5 text-right">{c.surface ?? "—"} m²</td>
                      <td className="py-1.5 text-right font-medium">
                        {c.prix.toLocaleString("fr-FR")} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
