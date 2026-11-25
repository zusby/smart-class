/* Funzioni condivise tra pagina giocatore (index.html) e conduttore (host.html) */
const LETTERS = ["A", "B", "C", "D"];
const CFG = window.QUIZ_CONFIG || {};
const CONFIGURED = !!(CFG.url && CFG.key && !/INSERISCI/.test(CFG.url + CFG.key));
const sb = CONFIGURED && window.supabase ? window.supabase.createClient(CFG.url, CFG.key) : null;

async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args || {});
  if (error) throw new Error(error.message || "Errore di rete");
  return data;
}

// Canale "ping": i giocatori avvisano il conduttore a ogni risposta, così lo schermo si aggiorna subito.
function pingChannel(onPing) {
  const ch = sb.channel("quiz-ping", { config: { broadcast: { self: false } } });
  if (onPing) ch.on("broadcast", { event: "ping" }, onPing);
  ch.subscribe();
  return ch;
}
function stateChannel(onChange) {
  return sb.channel("quiz-state")
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_state" }, (p) => onChange(p.new))
    .subscribe();
}

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const secs = (ms) => (ms / 1000).toFixed(1).replace(".", ",") + " s";
function ago(t) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? s + " s fa" : Math.round(s / 60) + " min fa";
}

// localStorage con ripiego in memoria (finestre private, storage bloccato)
const store = (() => {
  const mem = {};
  return {
    get(k) { try { const v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) {} return k in mem ? mem[k] : null; },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) {} },
  };
})();

function showNotConfigured(app) {
  app.replaceChildren(h("div", { class: "center" },
    h("h2", null, "Configurazione mancante"),
    h("p", { class: "muted" }, "Inserisci l'indirizzo del progetto Supabase e la chiave nel file config.js, poi ricarica.")));
}
