import type { Metadata } from "next";
import { ResumirScreen } from "@/components/resumir/ResumirScreen";

export const metadata: Metadata = { title: "Resumir · Hookly" };

export default function ResumirPage() {
  return <ResumirScreen />;
}
