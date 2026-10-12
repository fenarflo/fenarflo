import { emojisPorGrupo } from "./emojis";
import { POSICION_Y, type EstiloSub } from "./estilos";
import type { Grupo } from "./types";

/* Builds an Advanced SubStation (.ass) file that ffmpeg/libass burns into the video. */

// libass in ffmpeg.wasm has no fontconfig: fonts match by their name-table family (ID 1) only.
const EMOJI_FONT = "Noto Emoji Medium";

/** #RRGGBB + opacity → &HAABBGGRR (ASS alpha: 00 opaque, FF transparent). */
function color(hex: string, opacidad = 1) {
  const h = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const a = Math.round((1 - opacidad) * 255)
    .toString(16)
    .padStart(2, "0");
  return `&H${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
}

function alpha(opacidad: number) {
  return `&H${Math.round((1 - opacidad) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}&`;
}

function tiempo(s: number) {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

function limpiar(t: string) {
  return t.replace(/[{}\\]/g, "").replace(/\s+/g, " ");
}

export function generarASS({
  grupos,
  estilo,
  ancho,
  alto,
  emojis,
  marcaDeAgua,
  duracion,
}: {
  grupos: Grupo[];
  estilo: EstiloSub;
  ancho: number;
  alto: number;
  emojis: boolean;
  marcaDeAgua: boolean;
  duracion: number;
}) {
  const tam = Math.round(estilo.tamano * ancho);
  const margenH = Math.round(ancho * 0.08);
  const margenV = Math.round(alto * POSICION_Y);

  // BorderStyle 3 draws an opaque box (OutlineColour) behind each line.
  const borderStyle = estilo.caja ? 3 : 1;
  const outline = estilo.caja
    ? Math.round(estilo.caja.padding * ancho)
    : estilo.contorno
      ? Math.max(1, Math.round(estilo.contorno.grosor * ancho))
      : 0;
  const outlineColor = estilo.caja
    ? color(estilo.caja.color, estilo.caja.opacidad)
    : color(estilo.contorno?.color ?? "#000000");
  const shadow = estilo.sombra ? Math.max(1, Math.round(ancho * 0.004)) : 0;
  const back = estilo.sombra ? color("#000000", 0.55) : color("#000000", 0);
  const bold = estilo.peso >= 600 ? -1 : 0;

  const marcaTam = Math.round(ancho * 0.034);

  const lineas: string[] = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${ancho}`,
    `PlayResY: ${alto}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Sub,${estilo.fuenteAss},${tam},${color(estilo.texto)},${color(estilo.resaltado)},${outlineColor},${back},${bold},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,${margenH},${margenH},${margenV},1`,
    `Style: Marca,DM Sans,${marcaTam},${color("#FFFFFF", 0.6)},${color("#FFFFFF")},${color("#000000", 0.35)},${color("#000000", 0)},-1,0,0,0,100,100,0,0,1,${Math.max(1, Math.round(ancho * 0.002))},0,9,${margenH},${margenH},${Math.round(alto * 0.07)},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const emojiDe = emojis ? emojisPorGrupo(grupos) : grupos.map(() => null);
  const resaltadoColor = color(estilo.resaltado).replace("&H00", "&H");
  const pop = Math.round(estilo.pop * 100);

  grupos.forEach((g, gi) => {
    const palabras = g.palabras.map((p) => {
      const t = limpiar(p.text);
      return estilo.mayusculas ? t.toLocaleUpperCase("es-MX") : t;
    });
    const emoji = emojiDe[gi];

    g.palabras.forEach((p, i) => {
      const inicio = i === 0 ? g.start : p.start;
      const fin = i === g.palabras.length - 1 ? g.end : g.palabras[i + 1].start;
      if (fin - inicio < 0.01) return;

      const texto = palabras
        .map((w, j) => {
          if (j === i) {
            const popTag = pop !== 100 ? `\\fscx${pop - 6}\\fscy${pop - 6}\\t(0,90,\\fscx${pop}\\fscy${pop})\\t(90,200,\\fscx${pop - 4}\\fscy${pop - 4})` : "";
            return `{\\c${resaltadoColor}&${popTag}}${w}{\\r}`;
          }
          return estilo.inactivo < 1 ? `{\\1a${alpha(estilo.inactivo)}}${w}{\\r}` : w;
        })
        .join(" ");
      const bordEmoji = estilo.caja ? "" : `\\bord${Math.max(1, Math.round(outline / 3))}`;
      const conEmoji = emoji
        ? `${texto} {\\fn${EMOJI_FONT}\\b0\\fs${Math.round(tam * 0.85)}${bordEmoji}}${emoji}{\\r}`
        : texto;
      lineas.push(`Dialogue: 0,${tiempo(inicio)},${tiempo(fin)},Sub,,0,0,0,,${conEmoji}`);
    });
  });

  if (marcaDeAgua) {
    lineas.push(`Dialogue: 1,${tiempo(0)},${tiempo(duracion + 1)},Marca,,0,0,0,,hookly`);
  }

  return lineas.join("\n") + "\n";
}
