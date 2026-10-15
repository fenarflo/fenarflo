import type { Metadata } from "next";
import { CuentaScreen } from "@/components/cuenta/CuentaScreen";

export const metadata: Metadata = { title: "Cuenta · Hookly" };

export default function CuentaPage() {
  return <CuentaScreen />;
}
