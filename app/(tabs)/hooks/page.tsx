import type { Metadata } from "next";
import { HooksScreen } from "@/components/hooks/HooksScreen";

export const metadata: Metadata = { title: "Hooks · Hookly" };

export default function HooksPage() {
  return <HooksScreen />;
}
