import type { Metadata } from "next";
import { MiEstiloScreen } from "@/components/estilo/MiEstiloScreen";

export const metadata: Metadata = { title: "Mi estilo · Hookly" };

export default function MiEstiloPage() {
  return <MiEstiloScreen />;
}
