import type { Metadata } from "next";
import { SubtitulosScreen } from "@/components/subtitulos/SubtitulosScreen";

export const metadata: Metadata = { title: "Subtítulos · Hookly" };

export default function SubtitulosPage() {
  return <SubtitulosScreen />;
}
