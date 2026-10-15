import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="pb-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))]">
      <div className="mb-5 flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-[-0.02em]">
          hookly<span className="text-accent">.</span>
        </span>
        <div className="flex items-center gap-2">
          {aside}
          <Link
            href="/cuenta"
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted hover:text-ink"
          >
            Planes
          </Link>
        </div>
      </div>
      <h1 className="t-display">{title}</h1>
      {subtitle && <p className="mt-2 max-w-[34ch] text-[0.9375rem] text-muted">{subtitle}</p>}
    </header>
  );
}
