"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCaptions, IconHook, IconSummary, IconUser } from "@/components/ui/icons";
import { spring } from "@/lib/motion";

const TABS = [
  { href: "/resumir", label: "Resumir", Icon: IconSummary },
  { href: "/hooks", label: "Hooks", Icon: IconHook },
  { href: "/subtitulos", label: "Subtítulos", Icon: IconCaptions },
  { href: "/cuenta", label: "Cuenta", Icon: IconUser },
] as const;

export function BottomBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones"
      className="material-bar fixed inset-x-0 bottom-0 z-40 pb-[var(--safe-bottom)]"
    >
      <ul className="mx-auto grid h-[var(--bar-height)] max-w-lg grid-cols-4 px-2">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname?.startsWith(href) || (href === "/cuenta" && pathname?.startsWith("/mi-estilo"));
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  "relative flex flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl text-[0.75rem] font-semibold tracking-[0.01em] transition-colors duration-150 " +
                  (active ? "text-ink" : "text-faint hover:text-muted")
                }
              >
                <span className="relative grid h-8 w-14 place-items-center">
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      transition={spring}
                      className="absolute inset-0 rounded-full bg-accent/15"
                    />
                  )}
                  <Icon size={22} className={active ? "relative text-accent" : "relative"} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
