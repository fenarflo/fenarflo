/*
 * Hookly AI worker: Whisper speech-to-text and Spanish text-to-speech, entirely
 * on the device (transformers.js). The page cannot reach model hosts, so the
 * models ship with the page as 14 MB pieces (m/manifest.json) that this worker
 * reassembles and keeps in the browser cache for the next visit.
 */

const TF = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
const ORT_DIR = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/";
const BASE = new URL("./m/", self.location.href).href;
const CACHE = "hookly-modelos-v1";
const SR = 16000;
const MODELOS = {
  "onnx-community/whisper-base_timestamped": "whisper",
  "Xenova/mms-tts-spa": "tts",
};

const post = (m, transfer) => self.postMessage(m, transfer || []);
let manifestP = null;
const manifest = () => (manifestP ??= fetch(BASE + "manifest.json").then((r) => {
  if (!r.ok) throw new Error("manifest " + r.status);
  return r.json();
}));

/* Bytes received per file, so the page can show one progress bar per model. */
const progreso = { grupo: null, total: 0, hechos: new Map() };
function reportar() {
  if (!progreso.grupo) return;
  let n = 0;
  for (const v of progreso.hechos.values()) n += v;
  post({ type: "descarga", grupo: progreso.grupo, progreso: progreso.total ? Math.min(1, n / progreso.total) : 0 });
}
async function prepararProgreso(grupo, prefijos) {
  const m = await manifest();
  progreso.grupo = grupo;
  progreso.hechos = new Map();
  progreso.total = Object.entries(m.files).filter(([k]) => prefijos.some((p) => k.startsWith(p))).reduce((n, [, v]) => n + v.size, 0);
}

async function abrirCache() {
  try { return await caches.open(CACHE); } catch { return null; }
}

async function leerArchivo(rel) {
  const m = await manifest();
  const info = m.files[rel];
  if (!info) return null;
  const key = BASE + rel;
  const cache = await abrirCache();
  const hit = cache && (await cache.match(key).catch(() => null));
  if (hit) {
    progreso.hechos.set(rel, info.size); reportar();
    return await hit.blob();
  }
  const partes = [];
  let recibido = 0;
  for (let i = 0; i < info.parts; i++) {
    const r = await fetch(`${BASE}${rel}.${i}.wasm`);
    if (!r.ok || !r.body) throw new Error(`No se pudo descargar ${rel} (${r.status})`);
    const reader = r.body.getReader();
    const trozos = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      trozos.push(value);
      recibido += value.length;
      progreso.hechos.set(rel, recibido); reportar();
    }
    partes.push(new Blob(trozos));
  }
  const blob = new Blob(partes);
  if (cache) cache.put(key, new Response(blob)).catch(() => {});
  return blob;
}

/* transformers.js asks this "cache" first; it maps model URLs to our pieces. */
function relDe(key) {
  const s = String(key?.url ?? key);
  for (const [id, carpeta] of Object.entries(MODELOS)) {
    const i = s.indexOf(id + "/");
    if (i >= 0) return carpeta + "/" + s.slice(i + id.length + 1).replace(/^resolve\/[^/]+\//, "");
  }
  return null;
}
const customCache = {
  async match(key) {
    const rel = relDe(key);
    if (!rel) return undefined;
    const b = await leerArchivo(rel);
    return b ? new Response(b, { status: 200 }) : undefined;
  },
  async put() {},
};

let tfP = null;
function cargarTF() {
  return (tfP ??= (async () => {
    const tf = await import(TF);
    const { env } = tf;
    // Files we don't ship (optional configs) resolve to a same-origin 404, as they would online.
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.remoteHost = BASE + "__remoto__/";
    env.useBrowserCache = false;
    env.useCustomCache = true;
    env.customCache = customCache;
    const wasm = await leerArchivo("rt/ort.wasm");
    if (!wasm) throw new Error("runtime");
    env.backends.onnx.wasm.wasmBinary = await wasm.arrayBuffer();
    env.backends.onnx.wasm.wasmPaths = ORT_DIR;
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
    return tf;
  })().catch((e) => { tfP = null; throw e; }));
}

let asrP = null, ttsP = null;
function cargarASR() {
  return (asrP ??= (async () => {
    await prepararProgreso("voz", ["whisper/", "rt/"]);
    const tf = await cargarTF();
    // Encoder stays fp32: a quantized encoder breaks word timestamps.
    const asr = await tf.pipeline("automatic-speech-recognition", "onnx-community/whisper-base_timestamped", {
      device: "wasm",
      dtype: { encoder_model: "fp32", decoder_model_merged: "q8" },
    });
    progreso.grupo = null;
    return asr;
  })().catch((e) => { asrP = null; progreso.grupo = null; throw e; }));
}
function cargarTTS() {
  return (ttsP ??= (async () => {
    await prepararProgreso("narracion", ["tts/", "rt/"]);
    const tf = await cargarTF();
    const tts = await tf.pipeline("text-to-speech", "Xenova/mms-tts-spa", { device: "wasm", dtype: "q8" });
    progreso.grupo = null;
    return tts;
  })().catch((e) => { ttsP = null; progreso.grupo = null; throw e; }));
}

/* ≤29 s windows cut at the quietest point; silent windows are skipped (Whisper invents text over silence). */
function segmentar(audio) {
  const win = Math.floor(SR * 0.02);
  const n = Math.floor(audio.length / win);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * win; j < (i + 1) * win; j++) s += audio[j] * audio[j];
    e[i] = s / win;
  }
  const MIN = 20 * SR, MAX = 29 * SR;
  const segs = [];
  let ini = 0;
  while (audio.length - ini > MAX) {
    const a = Math.floor((ini + MIN) / win), b = Math.min(n - 1, Math.floor((ini + MAX) / win));
    let m = a;
    for (let i = a; i <= b; i++) if (e[i] < e[m]) m = i;
    const c = m * win + Math.floor(win / 2);
    segs.push([ini, c]);
    ini = c;
  }
  segs.push([ini, audio.length]);
  return segs.filter(([s, f]) => {
    let mx = 0;
    for (let i = Math.floor(s / win); i < Math.floor(f / win); i++) mx = Math.max(mx, e[i]);
    return mx > 1e-5;
  });
}

async function transcribir(audio) {
  const asr = await cargarASR();
  post({ type: "transcribiendo", progreso: 0, palabras: [] });
  const segs = segmentar(audio);
  const palabras = [];
  for (let i = 0; i < segs.length; i++) {
    const [s, f] = segs[i];
    const off = s / SR;
    const out = await asr(audio.subarray(s, f), { language: "spanish", task: "transcribe", return_timestamps: "word" });
    for (const c of out.chunks ?? []) {
      const text = (c.text ?? "").trim();
      if (!text) continue;
      const [a, b] = c.timestamp ?? [];
      const start = off + (a ?? 0);
      const end = off + (b ?? (a ?? 0) + 0.3);
      palabras.push({ text, start, end: Math.max(end, start + 0.05) });
    }
    post({ type: "transcribiendo", progreso: (i + 1) / segs.length, palabras: palabras.slice() });
  }
  return palabras;
}

async function hablar(texto) {
  const tts = await cargarTTS();
  post({ type: "sintetizando" });
  // Sentence by sentence keeps each run short and the voice steadier.
  const frases = texto.replace(/\s+/g, " ").trim().match(/[^.!?¡¿]+[.!?]*|[¡¿][^.!?]+[.!?]*/g) || [texto];
  const trozos = [];
  let sr = 16000;
  for (const f of frases) {
    const t = f.trim();
    if (!t) continue;
    const out = await tts(t);
    sr = out.sampling_rate || sr;
    trozos.push(out.audio);
    trozos.push(new Float32Array(Math.round(sr * 0.18))); // short pause between sentences
  }
  const len = trozos.reduce((n, a) => n + a.length, 0);
  const audio = new Float32Array(len);
  let o = 0;
  for (const a of trozos) { audio.set(a, o); o += a.length; }
  return { audio, sr };
}

self.onmessage = async (ev) => {
  const { id, type } = ev.data || {};
  try {
    if (type === "transcribir") {
      const palabras = await transcribir(ev.data.audio);
      post({ id, type: "ok", palabras });
    } else if (type === "hablar") {
      const { audio, sr } = await hablar(String(ev.data.texto || ""));
      post({ id, type: "ok", audio, sr }, [audio.buffer]);
    }
  } catch (e) {
    post({ id, type: "error", mensaje: String(e?.message || e) });
  }
};
