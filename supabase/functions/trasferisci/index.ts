// Funzione: trasferisci
// Solo l'owner può avviarla. Il festeggiato diventa owner e l'account del vecchio owner
// perde l'accesso (profilo rimosso e account bloccato).
// Impostazione richiesta: "Enforce JWT verification" DISATTIVATO (il controllo è fatto qui).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

// Chiave di servizio: i progetti nuovi usano SUPABASE_SECRET_KEYS, quelli vecchi SUPABASE_SERVICE_ROLE_KEY.
function chiaveServizio(): string {
  try {
    const chiavi = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const k = chiavi.default ?? Object.values(chiavi)[0];
    if (typeof k === "string" && k) return k;
  } catch { /* formato inatteso: si usa la chiave legacy */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function risposta(corpo: unknown, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return risposta({ errore: "metodo_non_valido" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    chiaveServizio(),
    { auth: { persistSession: false } },
  );

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: chi } = await admin.auth.getUser(jwt);
  if (!chi?.user) return risposta({ errore: "non_autenticato" }, 401);
  const { data: profilo } = await admin.from("profili").select("ruolo").eq("user_id", chi.user.id).maybeSingle();
  if (profilo?.ruolo !== "owner") return risposta({ errore: "solo_owner" }, 403);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return risposta({ errore: "richiesta_non_valida" }, 400); }
  if (corpo.conferma !== "TRASFERISCI") return risposta({ errore: "conferma_mancante" }, 400);

  const { data: festeggiato } = await admin
    .from("profili").select("user_id").eq("ruolo", "festeggiato").maybeSingle();
  if (!festeggiato) return risposta({ errore: "nessun_festeggiato" }, 404);

  const { error: errTrasf } = await admin.rpc("trasferisci_sito", {
    vecchio: chi.user.id,
    nuovo: festeggiato.user_id,
  });
  if (errTrasf) return risposta({ errore: "trasferimento_fallito", dettaglio: errTrasf.message }, 500);

  // Blocca l'account del vecchio owner (circa 100 anni). Il profilo è già stato rimosso,
  // quindi anche una sessione ancora aperta non vede più nessun dato.
  await admin.auth.admin.updateUserById(chi.user.id, { ban_duration: "876000h" });

  return risposta({ ok: true });
});
