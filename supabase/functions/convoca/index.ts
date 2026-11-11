// Funzione: convoca
// Solo l'owner può usarla. Azioni:
//   "stato"     -> dice se il festeggiato esiste e con quale email
//   "convoca"   -> crea l'account del festeggiato (già confermato) con password e sequenza
//   "reimposta" -> cambia password e/o sequenza del festeggiato
//   "revoca"    -> elimina l'account del festeggiato (es. email sbagliata)
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

async function sha256(testo: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sequenzaValida(s: unknown): s is number[] {
  return Array.isArray(s) && s.length >= 4 && s.length <= 9 &&
    s.every((n) => Number.isInteger(n) && n >= 1 && n <= 9) &&
    new Set(s).size === s.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return risposta({ errore: "metodo_non_valido" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    chiaveServizio(),
    { auth: { persistSession: false } },
  );

  // Chi sta chiamando?
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: chi } = await admin.auth.getUser(jwt);
  if (!chi?.user) return risposta({ errore: "non_autenticato" }, 401);
  const { data: profilo } = await admin.from("profili").select("ruolo").eq("user_id", chi.user.id).maybeSingle();
  if (profilo?.ruolo !== "owner") return risposta({ errore: "solo_owner" }, 403);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return risposta({ errore: "richiesta_non_valida" }, 400); }
  const azione = String(corpo.azione ?? "");

  const { data: festeggiato } = await admin
    .from("profili").select("user_id, email").eq("ruolo", "festeggiato").maybeSingle();

  if (azione === "stato") {
    return risposta({ convocato: !!festeggiato, email: festeggiato?.email ?? null });
  }

  if (azione === "convoca") {
    if (festeggiato) return risposta({ errore: "gia_convocato" }, 409);
    const email = String(corpo.email ?? "").trim().toLowerCase();
    const password = String(corpo.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return risposta({ errore: "email_non_valida" }, 400);
    if (password.length < 8) return risposta({ errore: "password_corta" }, 400);
    if (!sequenzaValida(corpo.sequenza)) return risposta({ errore: "sequenza_non_valida" }, 400);

    const { data: creato, error: errCrea } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (errCrea || !creato?.user) {
      const msg = (errCrea?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) return risposta({ errore: "email_gia_usata" }, 409);
      return risposta({ errore: "creazione_fallita" }, 500);
    }
    const id = creato.user.id;
    const hash = await sha256(`${id}:${(corpo.sequenza as number[]).join("-")}`);
    const passi = [
      await admin.from("profili").insert({ user_id: id, ruolo: "festeggiato", email }),
      await admin.from("impostazioni").insert({ user_id: id, sequenza_hash: hash }),
      await admin.from("progressi").insert({ user_id: id }),
    ];
    if (passi.some((p) => p.error)) {
      await admin.auth.admin.deleteUser(id);
      return risposta({ errore: "creazione_fallita" }, 500);
    }
    return risposta({ ok: true });
  }

  if (azione === "reimposta") {
    if (!festeggiato) return risposta({ errore: "nessun_festeggiato" }, 404);
    const id = festeggiato.user_id;
    if (corpo.password) {
      const password = String(corpo.password);
      if (password.length < 8) return risposta({ errore: "password_corta" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return risposta({ errore: "aggiornamento_fallito" }, 500);
    }
    if (corpo.sequenza) {
      if (!sequenzaValida(corpo.sequenza)) return risposta({ errore: "sequenza_non_valida" }, 400);
      const hash = await sha256(`${id}:${(corpo.sequenza as number[]).join("-")}`);
      const { error } = await admin.from("impostazioni").upsert({ user_id: id, sequenza_hash: hash });
      if (error) return risposta({ errore: "aggiornamento_fallito" }, 500);
    }
    return risposta({ ok: true });
  }

  if (azione === "revoca") {
    if (!festeggiato) return risposta({ errore: "nessun_festeggiato" }, 404);
    const { error } = await admin.auth.admin.deleteUser(festeggiato.user_id);
    if (error) return risposta({ errore: "revoca_fallita", dettaglio: error.message }, 500);
    return risposta({ ok: true });
  }

  return risposta({ errore: "azione_sconosciuta" }, 400);
});
