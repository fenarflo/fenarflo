/*
 * Whisper speech-to-text, running entirely in the browser (transformers.js).
 * Plain ES module worker served as a static file so the bundler never touches
 * the ONNX runtime. The model is downloaded once and cached by the browser.
 */

const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
const MODEL = "onnx-community/whisper-base_timestamped";
const SR = 16000;

// Approximate download size, so the bar doesn't restart for every file.
const TAMANO_ESPERADO = 140e6;

/*
 * Encoder must stay fp32: a quantized encoder breaks word-level timestamps
 * (every word lands on the same instant). The q8 decoder keeps it light.
 * WASM only: it's the path we test; WebGPU can come later for speed.
 */
const DTYPE = { encoder_model: "fp32", decoder_model_merged: "q8" };

let asrPromise = null;

const post = (msg) => self.postMessage(msg);

async function cargar() {
  const { pipeline, env } = await import(TRANSFORMERS);
  env.allowLocalModels = false;
  const archivos = new Map();
  let maximo = 0;
  const progress_callback = (p) => {
    if (p.status !== "progress" || !p.total) return;
    archivos.set(p.file, { loaded: p.loaded, total: p.total });
    let loaded = 0;
    let total = 0;
    for (const v of archivos.values()) {
      loaded += v.loaded;
      total += v.total;
    }
    maximo = Math.max(maximo, Math.min(1, loaded / Math.max(total, TAMANO_ESPERADO)));
    post({ type: "descarga", progreso: maximo });
  };
  const asr = await pipeline("automatic-speech-recognition", MODEL, {
    device: "wasm",
    dtype: DTYPE,
    progress_callback,
  });
  return { asr, device: "wasm" };
}

/** Splits audio into ≤29 s windows, cutting at the quietest moment near each limit. */
function segmentar(audio) {
  const win = Math.floor(SR * 0.02);
  const n = Math.floor(audio.length / win);
  const energia = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * win; j < (i + 1) * win; j++) s += audio[j] * audio[j];
    energia[i] = s / win;
  }
  const MIN = 20 * SR;
  const MAX = 29 * SR;
  const segs = [];
  let inicio = 0;
  while (audio.length - inicio > MAX) {
    const a = Math.floor((inicio + MIN) / win);
    const b = Math.min(n - 1, Math.floor((inicio + MAX) / win));
    let mejor = a;
    for (let i = a; i <= b; i++) if (energia[i] < energia[mejor]) mejor = i;
    const corte = mejor * win + Math.floor(win / 2);
    segs.push([inicio, corte]);
    inicio = corte;
  }
  segs.push([inicio, audio.length]);

  // Whisper tends to invent text over silence, so skip silent windows.
  return segs.filter(([s, e]) => {
    let max = 0;
    for (let i = Math.floor(s / win); i < Math.floor(e / win); i++) max = Math.max(max, energia[i]);
    return max > 1e-5;
  });
}

async function transcribir(audio) {
  asrPromise ??= cargar();
  let asr;
  let device;
  try {
    ({ asr, device } = await asrPromise);
  } catch (e) {
    asrPromise = null;
    throw e;
  }
  post({ type: "listo", device });

  const segs = segmentar(audio);
  const palabras = [];
  for (let i = 0; i < segs.length; i++) {
    const [s, e] = segs[i];
    const offset = s / SR;
    const out = await asr(audio.subarray(s, e), {
      language: "spanish",
      task: "transcribe",
      return_timestamps: "word",
    });
    for (const c of out.chunks ?? []) {
      const text = (c.text ?? "").trim();
      if (!text) continue;
      const [a, b] = c.timestamp ?? [];
      const start = offset + (a ?? 0);
      const end = offset + (b ?? (a ?? 0) + 0.3);
      palabras.push({ text, start, end: Math.max(end, start + 0.05) });
    }
    post({ type: "avance", progreso: (i + 1) / segs.length, palabras: palabras.slice() });
  }
  post({ type: "fin", palabras });
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg?.type !== "transcribir") return;
  try {
    await transcribir(msg.audio);
  } catch (e) {
    post({ type: "error", mensaje: String(e?.message ?? e) });
  }
};
