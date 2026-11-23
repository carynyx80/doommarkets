import type { ReactNode } from "react";

export default function PageHeader({ eyebrow, title, sub, right }: { eyebrow: string; title: ReactNode; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="h-display mt-3 text-4xl leading-[0.95] sm:text-5xl">{title}</h1>
        {sub && <p className="mt-3 max-w-xl text-sm text-white/50">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
