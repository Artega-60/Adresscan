import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Variables d'environnement à définir sur Vercel (Settings → Environment
// Variables) : SUPABASE_URL et SUPABASE_ANON_KEY, récupérées dans
// Supabase → Settings → API. On ne les préfixe pas par NEXT_PUBLIC_ car
// elles ne sont utilisées que côté serveur (dans la route API), jamais
// exposées au navigateur.
//
// Le client est créé à la demande (et pas au chargement du module) pour ne
// pas faire échouer le build quand les variables ne sont pas encore définies
// (par exemple en local, avant configuration de .env.local).

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "SUPABASE_URL ou SUPABASE_ANON_KEY manquant — vérifie les variables d'environnement sur Vercel."
    );
  }

  client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}


