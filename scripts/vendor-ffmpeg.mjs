// Copies the @ffmpeg/ffmpeg ESM build into public/ so it's served as static
// files. Bundlers can't follow its internal `new Worker(new URL(...))`.
import { cpSync, mkdirSync, readdirSync } from "node:fs";

const src = "node_modules/@ffmpeg/ffmpeg/dist/esm";
const dest = "public/vendor/ffmpeg";
mkdirSync(dest, { recursive: true });
for (const f of readdirSync(src)) if (f.endsWith(".js")) cpSync(`${src}/${f}`, `${dest}/${f}`);
console.log(`ffmpeg.wasm copiado a ${dest}`);
