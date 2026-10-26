import type { ReactNode } from "react";
export default function PlayerCard({ name, rating, color, clock, delta }: { name: string; rating?: number; color: "w" | "b"; clock: ReactNode; delta?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-3">
        <div aria-hidden className={`h-10 w-10 rounded-lg border-2 border-azure ${color === "w" ? "bg-white" : "bg-navy"}`} />
        <div>
          <div className="font-semibold leading-tight">{name}</div>
          <div className="text-sm text-slate2 dark:text-[#9FB3D9]">
            {rating ?? "—"}
            {delta ? <span className={`ml-1 font-semibold ${delta > 0 ? "text-emerald-600" : "text-red-500"}`}>{delta > 0 ? "+" : ""}{delta}</span> : null}
          </div>
        </div>
      </div>
      {clock}
    </div>
  );
}
