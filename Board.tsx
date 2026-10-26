"use client";
/**
 * Board: chessground rendering + chess.js legality. Drag-and-drop and click-to-move,
 * legal-move dots, last-move and check highlights, promotion picker.
 * Controlled by `fen`; reports moves via `onMove` (the server stays authoritative).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { Key } from "chessground/types";
import { Chess, type Square } from "chess.js";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.cburnett.css";
import "./board-sapphire.css";

interface Props {
  fen: string;
  orientation?: "white" | "black";
  interactive?: boolean; // false for spectators / finished games
  lastMove?: [Key, Key];
  onMove?: (uci: string) => void;
}

export default function Board({ fen, orientation = "white", interactive = true, lastMove, onMove }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api>();
  const [promo, setPromo] = useState<{ from: Key; to: Key } | null>(null);
  const chess = useMemo(() => new Chess(fen), [fen]);

  const dests = useMemo(() => {
    const map = new Map<Key, Key[]>();
    for (const m of chess.moves({ verbose: true })) {
      const list = map.get(m.from as Key) ?? [];
      list.push(m.to as Key);
      map.set(m.from as Key, list);
    }
    return map;
  }, [chess]);

  const turn = chess.turn() === "w" ? "white" : "black";

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, { animation: { duration: 180 }, highlight: { lastMove: true, check: true } });
    return () => api.current?.destroy();
  }, []);

  useEffect(() => {
    api.current?.set({
      fen, orientation, turnColor: turn, check: chess.inCheck(), lastMove,
      movable: {
        free: false,
        color: interactive ? orientation : undefined,
        dests: interactive ? dests : new Map(),
        showDests: true,
        events: {
          after: (from, to) => {
            const piece = chess.get(from as Square);
            if (piece?.type === "p" && (to[1] === "8" || to[1] === "1")) return setPromo({ from, to });
            onMove?.(from + to);
          },
        },
      },
      draggable: { showGhost: true },
      selectable: { enabled: true },
    });
  }, [fen, orientation, interactive, dests, lastMove, chess, turn, onMove]);

  const choose = (p: "q" | "r" | "b" | "n") => { if (promo) onMove?.(promo.from + promo.to + p); setPromo(null); };

  return (
    <div className="relative aspect-square w-full max-w-[min(92vw,calc(100vh-10rem))]" role="application"
         aria-label="Chess board">
      <div ref={el} className="cg-wrap h-full w-full" />
      {promo && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0F2A5C]/60"
             onClick={() => { setPromo(null); api.current?.set({ fen }); }}>
          <div className="flex gap-2 rounded-xl bg-white p-3 shadow-xl dark:bg-slate-900">
            {(["q", "r", "b", "n"] as const).map((p) => (
              <button key={p} onClick={(e) => { e.stopPropagation(); choose(p); }}
                className="h-16 w-16 rounded-lg bg-[#EAF2FF] text-2xl font-semibold text-[#0F2A5C] hover:bg-[#2F6BFF] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2F6BFF]"
                aria-label={{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
