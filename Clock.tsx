"use client";
import { useEffect, useState } from "react";
import type { GameState } from "@/lib/useGameSocket";
import { formatClock } from "@/lib/time";

/** Interpolates the side-to-move's clock locally between server snapshots. Clocks start after both sides have moved. */
export function useLiveClocks(state: GameState | null, over: boolean) {
  const [, force] = useState(0);
  const running = !!state && !over && state.san.length >= 2;
  useEffect(() => { if (!running) return; const i = setInterval(() => force((n) => n + 1), 100); return () => clearInterval(i); }, [running]);
  if (!state) return { w: 0, b: 0, running: false };
  const live = { ...state.clocks };
  if (running) live[state.turn] -= Date.now() - state.at;
  return { ...live, running };
}

export default function Clock({ ms, active, base }: { ms: number; active: boolean; base: number }) {
  const low = ms < Math.min(30_000, base * 1000 * 0.1);
  return (
    <div role="timer" aria-live="off"
      className={`min-w-[6.5rem] rounded-lg px-3 py-2 text-right text-2xl font-semibold tabular-nums transition-colors
        ${active ? (low ? "bg-red-600 text-white" : "bg-navy text-white") : "bg-[#D6E4FF] text-navy dark:bg-[#17294F] dark:text-ice"}`}>
      {formatClock(ms)}
    </div>
  );
}
