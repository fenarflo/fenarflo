# Hookly

Kit con IA para creadores de contenido en español (TikTok, Reels y Shorts).

- **Hooks**: 10 hooks por idea (polémica, pregunta, historia, dato, curiosidad), guion de 30–60 s y 5 captions con hashtags.
- **Subtítulos**: transcripción con Whisper **en el navegador**, subtítulos animados palabra por palabra, editables, y exportación 9:16 con ffmpeg.wasm.
- **Mi estilo**: colores, fuente, tono de voz y ejemplos de tus mejores hooks. Se guarda en el dispositivo (localStorage).

El costo es casi cero: el video nunca sale del dispositivo y solo los textos usan una API de IA (Claude Haiku 5.5, desde una única función serverless).

## Correrlo en tu computadora

Requisitos: Node.js 20 o más reciente.

```bash
npm install
cp .env.example .env.local   # y pon tu ANTHROPIC_API_KEY
npm run dev
```

Abre http://localhost:3000.

Variables de entorno (`.env.local`):

| Variable | Para qué |
| --- | --- |
| `ANTHROPIC_API_KEY` | Obligatoria. La usa solo `/api/generar`, en el servidor. Consíguela en console.anthropic.com. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Recomendadas en producción para que el límite de 3 al día funcione de verdad. Sin ellas, el contador vive en memoria y se reinicia. |
| `HOOKLY_SIN_LIMITE=1` | Solo para desarrollo: desactiva el límite diario. |
| `NEXT_PUBLIC_PRO_DEMO=1` | Muestra el interruptor «Simular plan Pro» en Planes (`/precios`) fuera de desarrollo (para demos). |

En `npm run dev` el interruptor «Simular plan Pro» siempre aparece en la pantalla de Planes.

Otros comandos: `npm run build`, `npm run lint`.

## Publicarlo gratis en Vercel

1. Sube este repositorio a GitHub (ya lo está si trabajas sobre esta rama).
2. Entra a https://vercel.com, inicia sesión con GitHub y elige **Add New → Project**. Importa el repositorio. Vercel detecta Next.js solo; no cambies nada del build.
3. En **Settings → Environment Variables** agrega `ANTHROPIC_API_KEY`.
4. Para el límite diario real: en **Storage** (o en el Marketplace) agrega **Upstash Redis** en el plan gratis y conéctalo al proyecto. Vercel crea las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_*`); Hookly lee cualquiera de las dos.
5. Haz **Deploy**. Cada push a la rama principal vuelve a publicar.

Para usar otra rama como producción: **Settings → Git → Production Branch**.

## Cómo funciona

```
app/
  (tabs)/hooks, subtitulos, mi-estilo, precios   Pantallas (barra inferior)
  api/generar/route.ts                           Única función serverless (IA de texto)
components/                                      UI: hooks, subtitulos, estilo, precios, ui
lib/
  ai/          Prompts y esquemas zod (entrada y salida del modelo)
  captions/    Agrupar palabras, emojis, estilos y generador de .ass
  video/       Validación, audio, worker de Whisper, ffmpeg.wasm y estado de la sesión
  rate-limit.ts  3 generaciones al día (Upstash Redis o memoria)
  storage.ts     localStorage con try/catch
public/
  workers/whisper.js   Whisper (transformers.js desde CDN) en un Web Worker
  vendor/ffmpeg/       Build ESM de @ffmpeg/ffmpeg (npm run vendor:ffmpeg)
  fonts/               Fuentes que se queman en el video
```

- **Límite diario**: se cuenta por una cookie anónima y por IP (con un tope por IP más alto, porque las redes móviles comparten IP). El día se cuenta con la hora de la Ciudad de México.
- **Pro**: `isPro` (`lib/plan.ts`) quita la marca de agua y habilita 1080p. Los pagos no están conectados; la pantalla de Planes ya está lista.
- **Modelo de voz**: `whisper-base` con codificador fp32 y decodificador q8, unos 140 MB. Se descarga la primera vez y queda en la caché del navegador. El codificador debe quedarse en fp32 porque cuantizado rompe las marcas de tiempo por palabra.
- **Exportación**: ffmpeg.wasm de un solo hilo, así que no se necesitan cabeceras especiales. Recorta al centro a 9:16 y quema un `.ass` con libass. Un video de 1 minuto tarda unos minutos en una laptop.
- **Fuentes en el video**: el libass de ffmpeg.wasm no tiene fontconfig, así que cada fuente se nombra en el `.ass` por su familia exacta (`name ID 1`). `NotoEmoji-Medium.ttf` conserva solo su tabla `cmap` de formato 12; si no, los emojis salen como cuadros.

## Límites del MVP

- Videos de hasta 10 minutos y 500 MB (200 MB en teléfonos). Si el video es muy pesado o largo, se muestra un mensaje en vez de intentarlo.
- La transcripción y la exportación corren en el dispositivo: en teléfonos de gama baja pueden ser lentas.
- El historial y el estilo viven solo en ese navegador (no hay login).
