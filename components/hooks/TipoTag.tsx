import type { TipoHook } from "@/lib/ai/schema";
import { TIPO_ESTILO } from "./tipos";

export function TipoTag({ tipo }: { tipo: TipoHook }) {
  const t = TIPO_ESTILO[tipo];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold tracking-[0.02em]"
      style={{ color: t.color, background: `${t.color}1A` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
      {t.label}
    </span>
  );
}
