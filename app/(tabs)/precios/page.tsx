import type { Metadata } from "next";
import { PreciosScreen } from "@/components/precios/PreciosScreen";

export const metadata: Metadata = { title: "Planes · Hookly" };

export default function PreciosPage() {
  return <PreciosScreen />;
}
