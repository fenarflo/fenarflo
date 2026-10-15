# Hookly web (página de Claude)

Versión de Hookly que corre como página dentro de Claude, sin servidor ni API key:

- `hookly.html`: la app completa (Hooks, Editor, Mi estilo, Planes). La IA de texto usa la capacidad `sample` de la página.
- `ai-worker.js`: Whisper (transcripción) y voz en español (MMS-TTS) en el dispositivo con transformers.js 3.8.1.

Los modelos se publican junto a la página en `m/`, partidos en pedazos de 14 MB con extensión `.wasm`
(`m/manifest.json` lista tamaño y número de partes):

- `onnx-community/whisper-base_timestamped`: `encoder_model.onnx` (fp32) y `decoder_model_merged_quantized.onnx`, más sus JSON.
- `Xenova/mms-tts-spa`: `onnx/model_quantized.onnx` y sus JSON.
- `rt/ort.wasm`: `ort-wasm-simd-threaded.jsep.wasm` de transformers 3.8.1.
