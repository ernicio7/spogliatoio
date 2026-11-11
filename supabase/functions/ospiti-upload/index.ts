// Funzione: ospiti-upload
// Riceve le foto dal settore ospiti. Controlla il token del link e la scadenza,
// poi salva la foto nello spazio privato. Gli ospiti non possono leggere nulla.
// Impostazione richiesta: "Enforce JWT verification" DISATTIVATO (il controllo è il token).
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
const MAX_BYTE = 15 * 1024 * 1024;
const ESTENSIONI: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
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

  let token = "";
  let foto: File | null = null;
  const tipo = req.headers.get("content-type") ?? "";
  try {
    if (tipo.includes("multipart/form-data")) {
      const form = await req.formData();
      token = String(form.get("token") ?? "");
      const f = form.get("foto");
      foto = f instanceof File ? f : null;
    } else {
      const corpo = await req.json();
      token = String(corpo?.token ?? "");
    }
  } catch {
    return risposta({ errore: "richiesta_non_valida" }, 400);
  }

  if (token.length < 20) return risposta({ errore: "link_non_valido" }, 403);

  const { data: link, error } = await admin
    .from("link_ospiti")
    .select("id, scade_il, attivo")
    .eq("token", token)
    .maybeSingle();
  if (error) return risposta({ errore: "errore_server" }, 500);
  if (!link || !link.attivo) return risposta({ errore: "link_non_valido" }, 403);
  if (new Date(link.scade_il).getTime() < Date.now()) {
    return risposta({ errore: "link_scaduto", scade_il: link.scade_il }, 403);
  }

  // Solo verifica del link (nessun file allegato)
  if (!foto) {
    const { data: cfg } = await admin.from("config_sito").select("valore")
      .eq("chiave", "nome_festeggiato").maybeSingle();
    return risposta({ ok: true, scade_il: link.scade_il, nome: cfg?.valore ?? null });
  }

  const est = ESTENSIONI[foto.type];
  if (!est) return risposta({ errore: "tipo_non_valido" }, 415);
  if (foto.size > MAX_BYTE) return risposta({ errore: "file_troppo_grande" }, 413);

  const percorso = `ospiti/${crypto.randomUUID()}.${est}`;
  const { error: errUpload } = await admin.storage
    .from("foto")
    .upload(percorso, foto, { contentType: foto.type, upsert: false });
  if (errUpload) return risposta({ errore: "caricamento_fallito" }, 500);

  const { error: errRiga } = await admin.from("foto").insert({ percorso, origine: "ospite" });
  if (errRiga) {
    await admin.storage.from("foto").remove([percorso]);
    return risposta({ errore: "caricamento_fallito" }, 500);
  }
  return risposta({ ok: true });
});
