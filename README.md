# Hookly

Sube un video largo (una clase, un pódcast, una transmisión) y Hookly saca **lo más importante de todo el video** en un resumen narrado del largo que tú elijas. En español de México.

- **Resumir**, la función principal, tiene tres modos:
  - **Resumen narrado**: elige los mejores momentos de principio a fin. Un narrador (voz natural o texto en pantalla) explica cada punto. Incluye capítulos para YouTube, texto para publicar y un comentario para fijar.
  - **Clase**: un video de repaso, apuntes descargables, conceptos clave, un quiz de 5 preguntas y los momentos de la clase con su minuto.
  - **Shorts**: de 3 a 5 clips verticales del mismo video. Cada uno trae hook, caption, hashtags, comentario fijado y una revisión de si «se entiende sin contexto».
- **Hooks**: 10 hooks por idea, guion y captions.
- **Subtítulos**: subtítulos animados en el navegador.
- **Cuenta**: planes con Stripe, minutos, paquetes, invitaciones y tu código para usar la cuenta en otro dispositivo.

Hookly no promete vistas ni seguidores, y la IA solo usa lo que se dijo en el video.

## Cómo funciona un resumen

```
Teléfono                                   Servidor (funciones cortas, < 30 s cada una)
───────                                    ──────────────────────────────────────────────
1. Elige video (no se sube)
2. ffmpeg.wasm copia el audio en trozos
   de 90 s, sin decodificar (segundos
   incluso para 1 hora)            ──►  /api/trabajo      cobra los minutos y firma el trabajo
3. Sube los trozos, 3 a la vez     ──►  /api/transcribir  Groq Whisper (o OpenAI) → palabras con tiempo
4. Tramos de ~6 min, 4 a la vez    ──►  /api/resumen/puntos   Claude: momentos clave de cada tramo
5. Todos los momentos              ──►  /api/resumen/armar    Claude: elige momentos para la duración pedida
                                                              y escribe al narrador (+ apuntes / quiz)
6. Cada frase del narrador         ──►  /api/voz          OpenAI TTS (voz natural, acento mexicano)
7. Arma el video en un canvas: cortes del original, voz, subtítulos, título.
   Se ve igual en el preview y en el MP4 exportado.
```

- El **video nunca sale del teléfono**: solo se envía el audio. Por eso un video de una hora funciona en un iPhone.
- **Sincronía**: el reloj de audio solo avanza mientras suena un corte, así que la voz no se desfasa aunque el teléfono tarde en saltar al siguiente momento.
- **Costos acotados**: cada trabajo lleva un token firmado (`HOOKLY_SECRET`). Cada llamada a la IA tiene un presupuesto según la duración del video.
- Si algo falla antes de escribir el resumen, **los minutos se devuelven** solos.
- **«Otra versión»** (otra duración, otro ángulo, voz o texto) reutiliza la transcripción y no gasta minutos.

## Negocio

| | Precio | Minutos de video al mes | Lo principal |
| --- | --- | --- | --- |
| Gratis | $0 | 15 | Resúmenes de hasta 60 s, con marca de agua |
| Estudiante | $69 MXN/mes | 300 (5 h) | Clases: video, apuntes, quiz. Sin marca de agua |
| Creador Pro | $149 MXN/mes | 600 (10 h) | Shorts, capítulos, 1080p, 50 hooks al día |
| Paquete | $49 MXN (2 h) · $179 MXN (10 h) | No caducan | Pago único, también en **OXXO** |

- **Invitaciones**: cuando alguien que invitaste hace su primer pago, tú ganas 60 min y esa persona 30. Su link es `/?ref=CÓDIGO`.
- **Costo aproximado por hora de video**: Groq ~$0.04 USD, Claude Haiku ~$0.03 USD y la voz ~$0.05 USD por resumen narrado. En total son unos $2 MXN. Con Pro, aunque se usen las 10 horas, el margen sigue siendo alto.
- Los precios y minutos se cambian en `lib/planes.ts`. Stripe crea los precios desde ahí, así que no hay que dar de alta productos en el dashboard.

## Configuración (Netlify)

En **Site configuration → Environment variables** (ver `.env.example`):

| Variable | Dónde se consigue |
| --- | --- |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `GROQ_API_KEY` | console.groq.com → API Keys (transcripción barata) |
| `OPENAI_API_KEY` | platform.openai.com → API keys. Da la **voz del narrador** y transcribe si no hay Groq. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | console.upstash.com → Create database (gratis) → REST API |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Ver los pasos de Stripe abajo |
| `HOOKLY_SECRET` | Cualquier texto largo y aleatorio |

**Stripe, una sola vez:**

1. **Developers → Webhooks → Add endpoint** con la URL `https://TU-SITIO.netlify.app/api/pagos/webhook` y estos eventos:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copia el *Signing secret* a `STRIPE_WEBHOOK_SECRET`.
2. **Settings → Billing → Customer portal**: actívalo y guarda. Es lo que abre el botón «Administrar suscripción».
3. *(Opcional)* **Settings → Payment methods**: activa **OXXO** para los paquetes.
4. Prueba con `sk_test_…` y la tarjeta `4242 4242 4242 4242`. Cuando funcione, cambia a la llave `sk_live_…`.

Sin cuentas ni contraseñas: cada persona tiene una cuenta anónima (cookie) y un **código de acceso** en *Cuenta* para abrirla en otro dispositivo. Si alguien paga desde otro navegador, la página de regreso de Stripe le trae su cuenta.

## Correrlo en tu computadora

```bash
npm install
cp .env.example .env.local   # llena las llaves
npm run dev                  # http://localhost:3000
```

Sin Redis todo vive en memoria (sirve para desarrollo).

Otros comandos: `npm run build`, `npm run lint`.

## Estructura

```
app/(tabs)/resumir, hooks, subtitulos, cuenta, mi-estilo   Pantallas
app/api/trabajo, transcribir, resumen/{puntos,armar}, voz   Resúmenes
app/api/cuenta, pagos/{checkout,confirmar,portal,webhook}  Cuenta y Stripe
app/api/generar                                             Hooks
lib/planes.ts            Planes, paquetes, precios
lib/server/              Cuentas y minutos (Redis), tokens, proveedores de IA, Stripe
lib/resumen/             Audio (ffmpeg.wasm), orquestador, motor de render, prompts, esquemas
components/resumir/      Pantalla Resumir, progreso, reproductor, resultado y extras
components/cuenta/       Saldo, planes, paquetes, invitaciones, código de acceso
```

## Límites

- Videos de hasta 3 horas. Un video de 1 hora pesa varios GB en un iPhone, pero solo se lee su audio, así que no hay que subirlo.
- La exportación se graba en tiempo real: un resumen de 60 s tarda unos 60 s. Hay que mantener la pantalla encendida (Hookly lo pide al sistema cuando puede).
- iPhone exporta MP4 (H.264). Chrome en Android y en computadora puede exportar WebM.
