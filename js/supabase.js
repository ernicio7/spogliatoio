import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "spogliatoio-sessione" },
});

// Chiama una funzione lato server e restituisce sempre un oggetto:
// { stato: <codice HTTP, 0 se rete assente>, ...campi della risposta }
export async function chiamaFunzione(nome, corpo, { formData = null, conSessione = true } = {}) {
  const headers = { apikey: SUPABASE_ANON_KEY };
  if (conSessione) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let body;
  if (formData) {
    body = formData;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(corpo ?? {});
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${nome}`, { method: "POST", headers, body });
    const dati = await res.json().catch(() => ({}));
    return { stato: res.status, ...dati };
  } catch {
    return { stato: 0, errore: "rete" };
  }
}
