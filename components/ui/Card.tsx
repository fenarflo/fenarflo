export function Card({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-line bg-card p-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
