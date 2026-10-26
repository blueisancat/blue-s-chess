"use client";
import { useEffect, useState } from "react";
import { PRESETS, tcLabel, type Category } from "@/lib/time";
import type { SeekParams } from "@/lib/useGameSocket";

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string; off?: boolean }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-lg bg-ice p-1 dark:bg-[#17294F]">
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} disabled={o.off} onClick={() => onChange(o.v)}
          className={`flex-1 rounded-md px-2 py-1.5 text-sm font-semibold capitalize disabled:opacity-35 ${value === o.v ? "bg-azure text-white" : "hover:bg-white dark:hover:bg-[#1F3668]"}`}>{o.label}</button>
      ))}
    </div>
  );
}

export default function NewGameDialog({ open, onClose, onStart }: { open: boolean; onClose: () => void; onStart: (p: SeekParams) => void }) {
  const [mode, setMode] = useState<"human" | "computer">("human");
  const [cat, setCat] = useState<Category>("blitz");
  const [tc, setTc] = useState<[number, number]>([300, 0]);
  const [rated, setRated] = useState(true);
  const [color, setColor] = useState<SeekParams["color"]>("random");
  const [variant, setVariant] = useState("standard");
  const [level, setLevel] = useState(3);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open, onClose]);
  if (!open) return null;
  const colors = [{ v: "w" as const, label: "White" }, { v: "random" as const, label: "Random" }, { v: "b" as const, label: "Black" }];
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-navy/60 p-4" onClick={onClose}>
      <div role="dialog" aria-modal aria-label="New game" onClick={(e) => e.stopPropagation()} className="panel w-full max-w-md space-y-4 p-6 shadow-2xl">
        <h2 className="text-xl font-bold">New game</h2>
        <Seg label="Opponent" value={mode} onChange={setMode} options={[{ v: "human", label: "Play a person" }, { v: "computer", label: "Play computer" }]} />
        {mode === "human" ? (<>
          <Seg label="Time category" value={cat} onChange={(c) => { setCat(c); if (c !== "daily") setTc(PRESETS[c][0]); }}
            options={[...(Object.keys(PRESETS) as Category[]).map((v) => ({ v, label: v })), { v: "daily" as Category, label: "Daily", off: true }]} />
          {cat !== "daily" && (
            <div className="grid grid-cols-4 gap-2">
              {PRESETS[cat].map(([b, i]) => (
                <button key={b + "+" + i} onClick={() => setTc([b, i])} aria-pressed={tc[0] === b && tc[1] === i}
                  className={`rounded-lg py-3 text-sm font-bold ${tc[0] === b && tc[1] === i ? "bg-navy text-white" : "bg-ice hover:bg-[#D6E4FF] dark:bg-[#17294F]"}`}>{tcLabel(b, i)}</button>
              ))}
            </div>)}
          <Seg label="Variant" value={variant} onChange={setVariant} options={[{ v: "standard", label: "Standard" }, { v: "chess960", label: "Chess960" }]} />
          <Seg label="Color" value={color} onChange={setColor} options={colors} />
          <Seg label="Rating" value={rated ? "r" : "u"} onChange={(v) => setRated(v === "r")} options={[{ v: "r", label: "Rated" }, { v: "u", label: "Casual" }]} />
          <button className="btn-primary w-full py-3 text-base" onClick={() => onStart({ base: tc[0], inc: tc[1], rated, color, variant })}>Find opponent</button>
        </>) : (<>
          <label className="block text-sm font-semibold">Level {level}
            <input type="range" min={1} max={8} value={level} onChange={(e) => setLevel(+e.target.value)} className="mt-1 w-full accent-azure" /></label>
          <Seg label="Color" value={color} onChange={setColor} options={colors} />
          <button className="btn-primary w-full py-3 text-base" disabled>Start (needs Stockfish, coming next)</button>
        </>)}
      </div>
    </div>
  );
}
