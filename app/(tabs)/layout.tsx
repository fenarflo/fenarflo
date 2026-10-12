import { BottomBar } from "@/components/nav/BottomBar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-lg px-4 pb-[calc(var(--bar-height)+var(--safe-bottom)+2rem)]">
        {children}
      </main>
      <BottomBar />
    </>
  );
}
