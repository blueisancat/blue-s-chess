"use client";
import { useEffect, useRef } from "react";

interface Props { san: string[]; ply: number; onJump: (ply: number) => void; evals?: (string | null)[] }

/** Two-column move list. `ply` 0 = start position; move i is ply i+1. Pass `evals` to show engine scores. */
export default function MoveList({ san, ply, onJump, evals }: Props) {
  const cur = useRef<HTMLButtonElement>(null);
  useEffect(() => cur.current?.scrollIntoView({ block: "nearest" }), [ply, san.length]);
  const rows = Array.from({ length: Math.ceil(san.length / 2) }, (_, i) => i);
  const cell = (i: number) =>
    san[i] ? (
      <button ref={ply === i + 1 ? cur : undefined} onClick={() => onJump(i + 1)} aria-current={ply === i + 1}
        className={`flex flex-1 items-center justify-between rounded px-2 py-1 text-left font-medium hover:bg-[#D6E4FF] dark:hover:bg-[#1F3668]
          ${ply === i + 1 ? "bg-azure text-white hover:bg-azure dark:hover:bg-azure" : ""}`}>
        {san[i]}{evals && <span className="text-xs opacity-70">{evals[i] ?? ""}</span>}
      </button>
    ) : <span className="flex-1" />;
  return (
    <div className="max-h-64 overflow-y-auto p-2 text-sm lg:max-h-none lg:flex-1" role="list" aria-label="Moves">
      {rows.length === 0 && <p className="p-3 text-slate2">No moves yet.</p>}
      {rows.map((r) => (
        <div key={r} role="listitem" className="flex items-center">
          <span className="w-8 text-slate2">{r + 1}.</span>{cell(r * 2)}{cell(r * 2 + 1)}
        </div>
      ))}
    </div>
  );
}
