/*
 * Local word → emoji dictionary (no AI, no network). Matches on the start of
 * the normalized word so "dinero", "dineros" and "dinerito" all match "diner".
 * Emojis go in the video captions only, never in the app UI.
 */
const DICCIONARIO: [string[], string][] = [
  [["diner", "lana", "varo", "pesos", "sueldo", "salario", "quincena", "pago"], "💰"],
  [["ahorr", "invers", "invert"], "📈"],
  [["deud", "tarjeta", "credito"], "💳"],
  [["amor", "quier", "corazon", "novi"], "❤️"],
  [["fuego", "brutal", "increibl", "epic"], "🔥"],
  [["comid", "comer", "cocin", "receta", "taco", "hambre"], "🌮"],
  [["cafe"], "☕"],
  [["gym", "ejercici", "entren", "muscul", "pesas"], "💪"],
  [["correr", "corri", "corro", "carrera", "maraton"], "🏃"],
  [["dormi", "sueño", "cansad"], "😴"],
  [["risa", "jaja", "chistos", "gracios"], "😂"],
  [["triste", "llor"], "😢"],
  [["miedo", "terror", "susto"], "😱"],
  [["error", "fallo", "equivoc"], "❌"],
  [["correct", "exito", "logr"], "✅"],
  [["idea", "truco", "tips", "consejo", "secreto"], "💡"],
  [["tiempo", "minut", "hora", "rapid"], "⏱️"],
  [["celular", "telefon", "app", "iphone", "android"], "📱"],
  [["compu", "laptop", "codigo", "program"], "💻"],
  [["viaj", "vuelo", "avion", "playa"], "✈️"],
  [["casa", "hogar", "depa", "renta"], "🏠"],
  [["trabaj", "chamba", "jefe", "oficina", "negocio", "empresa"], "💼"],
  [["escuel", "estudi", "examen", "clase", "aprend"], "📚"],
  [["mama", "papa", "hij", "bebe", "familia"], "👪"],
  [["perr", "lomito", "gato", "michi", "mascota"], "🐶"],
  [["music", "cancion", "cantar"], "🎵"],
  [["video", "grab", "camara", "contenido"], "🎬"],
  [["regal", "sorpresa", "cumple"], "🎁"],
  [["ojo", "atencion", "cuidado"], "👀"],
  [["pregunt", "duda"], "🤔"],
  [["ganar", "gane", "premio", "campeon"], "🏆"],
  [["salud", "doctor", "medic"], "🩺"],
  [["belleza", "maquill", "piel"], "💄"],
  [["ropa", "outfit", "moda"], "👗"],
  [["juego", "gamer", "gaming", "jugar"], "🎮"],
];

const MIN_LARGO = 3;

function normalizar(w: string) {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zñ0-9]/g, "");
}

export function emojiPara(palabra: string): string | null {
  const w = normalizar(palabra);
  if (w.length < MIN_LARGO) return null;
  for (const [raices, emoji] of DICCIONARIO) {
    if (raices.some((r) => w.startsWith(normalizar(r)))) return emoji;
  }
  return null;
}

/**
 * Picks at most one emoji per line, and skips lines right after one that had
 * an emoji, so they stay occasional instead of noisy.
 */
export function emojisPorGrupo(grupos: { palabras: { text: string }[] }[]): (string | null)[] {
  let anterior = false;
  return grupos.map((g) => {
    if (anterior) {
      anterior = false;
      return null;
    }
    for (const p of g.palabras) {
      const e = emojiPara(p.text);
      if (e) {
        anterior = true;
        return e;
      }
    }
    return null;
  });
}
