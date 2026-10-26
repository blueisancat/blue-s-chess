"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Key } from "chessground/types";
import Board from "./Board";
import Clock, { useLiveClocks } from "./Clock";
import PlayerCard from "./PlayerCard";
import MoveList from "./MoveList";
import Chat from "./Chat";
import GameResult from "./GameResult";
import NewGameDialog from "./NewGameDialog";
import { useGameSocket, useGuestId } from "@/lib/useGameSocket";
import { tcLabel } from "@/lib/time";
import { play } from "@/lib/sound";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function GameRoom({ watchId }: { watchId?: string }) {
  const uid = useGuestId();
  const g = useGameSocket(uid, watchId);
  const { state, color, result } = g;
  const [flipped, setFlipped] = useState(false);
  const [view, setView] = useState<number | null>(null); // null = live position
  const [dialog, setDialog] = useState(!watchId);
  const [hideResult, setHideResult] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const over = !!result || state?.status === "finished";
  const clocks = useLiveClocks(state, over);

  // Replay SAN into positions so any move can be jumped to.
  const san = state?.san ?? [];
  const { fens, moves } = useMemo(() => {
    const c = new Chess(state?.startFen);
    const fens = [c.fen()], moves: [Key, Key][] = [];
    for (const s of san) { const m = c.move(s); fens.push(c.fen()); moves.push([m.from as Key, m.to as Key]); }
    return { fens, moves };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [san.join(" "), state?.startFen]);
  const last = fens.length - 1, ply = view ?? last, live = ply === last;
  const jump = useCallback((p: number) => setView(p >= last ? null : Math.max(0, p)), [last]);

  // Sounds + snap back to live on every new move.
  const prev = useRef(0);
  useEffect(() => {
    if (san.length > prev.current) { const s = san[san.length - 1]; play(/[+#]/.test(s) ? "check" : s.includes("x") ? "capture" : "move"); setView(null); }
    prev.current = san.length;
  }, [san.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (result) { play("end"); setHideResult(false); } }, [result]);
  useEffect(() => { if (state?.gameId) setDialog(false); }, [state?.gameId]);

  const mine = color ? clocks[color] : 0, secs = Math.ceil(mine / 1000);
  useEffect(() => { if (clocks.running && color === state?.turn && secs > 0 && secs <= 10) play("low"); }, [secs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft") jump(ply - 1); else if (e.key === "ArrowRight") jump(ply + 1);
      else if (e.key === "Home") jump(0); else if (e.key === "End") jump(last);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [ply, last, jump]);

  const orientation = (color === "b") !== flipped ? "black" : "white";
  const bottom = orientation === "white" ? "w" : "b", top = bottom === "w" ? "b" : "w";
  const canMove = !!color && !over && live && state?.turn === color;
  const opp = color === "w" ? "b" : "w";
  const player = (c: "w" | "b") => (
    <PlayerCard color={c} name={state ? (state.players[c].uid === uid ? "You" : state.players[c].uid) : c === "w" ? "White" : "Black"}
      rating={state?.players[c].rating} delta={result?.deltas[c]}
      clock={<Clock ms={state ? clocks[c] : 0} base={state?.base ? state.base / 1000 : 300} active={!!state && !over && clocks.running && state.turn === c} />} />
  );
  const offer = state?.offers;

  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-6">
      <section>
        {player(top)}
        <div className="relative my-1">
          <Board fen={fens[ply] ?? START} orientation={orientation} playerColor={color === "b" ? "black" : "white"}
            interactive={canMove} lastMove={ply > 0 ? moves[ply - 1] : undefined} onMove={g.move} />
          {g.seeking && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-navy/60 text-white">
              <p className="text-lg font-semibold">Looking for an opponent…</p>
              <button className="btn-quiet" onClick={g.cancelSeek}>Cancel</button>
            </div>)}
          {!state && !g.seeking && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-navy/30">
              <button className="btn-primary px-8 py-3 text-base" onClick={() => setDialog(true)}>New game</button></div>)}
          {result && !hideResult && (
            <GameResult winner={result.winner} color={color} reason={result.reason} delta={color ? result.deltas[color] : 0}
              onNew={() => setDialog(true)} onClose={() => setHideResult(true)} />)}
        </div>
        {player(bottom)}
      </section>

      <aside className="flex flex-col gap-3">
        <div className="panel flex flex-col lg:h-[28rem]">
          <div className="flex items-center justify-between border-b border-ice p-3 dark:border-[#17294F]">
            <span className="font-semibold">{state ? `${tcLabel(state.base / 1000, state.inc / 1000)} · ${state.rated ? "Rated" : "Casual"}${state.variant === "chess960" ? " · 960" : ""}` : "Blue Chess"}</span>
            <span className="flex items-center gap-2 text-sm text-slate2">
              {state && <span>{state.spectators} watching</span>}
              <button className="btn-quiet !px-2 !py-1" onClick={() => setFlipped((f) => !f)} aria-label="Flip board">⇅</button>
            </span>
          </div>
          <MoveList san={san} ply={ply} onJump={jump} />
          <div className="flex justify-center gap-1 border-t border-ice p-2 dark:border-[#17294F]">
            {([["⏮", 0], ["◀", ply - 1], ["▶", ply + 1], ["⏭", last]] as const).map(([l, p]) => (
              <button key={l} className="btn-quiet !px-3 !py-1" onClick={() => jump(p)} aria-label={`Go to move ${p}`}>{l}</button>))}
          </div>
        </div>

        {color && !over && state && (
          <div className="panel space-y-2 p-3">
            {offer?.draw === opp && <Prompt text="Opponent offers a draw" onYes={() => g.act("draw_accept")} onNo={() => g.act("draw_decline")} />}
            {offer?.takeback === opp && <Prompt text="Opponent asks to take back a move" onYes={() => g.act("takeback_accept")} onNo={() => g.act("takeback_decline")} />}
            <div className="grid grid-cols-2 gap-2">
              {san.length < 2 && <button className="btn-quiet" onClick={() => g.act("abort")}>Abort</button>}
              <button className="btn-quiet" disabled={san.length < 2 || offer?.draw === color} onClick={() => g.act("draw_offer")}>{offer?.draw === color ? "Draw offered" : "Offer draw"}</button>
              <button className="btn-quiet" disabled={san.length < 1 || offer?.takeback === color} onClick={() => g.act("takeback_offer")}>Takeback</button>
              <button className={confirmResign ? "btn bg-red-600 text-white" : "btn-quiet"}
                onClick={() => (confirmResign ? g.act("resign") : (setConfirmResign(true), setTimeout(() => setConfirmResign(false), 3000)))}>
                {confirmResign ? "Confirm resign" : "Resign"}</button>
            </div>
          </div>)}

        {state && <div className="panel"><Chat messages={g.chat} myColor={color} onSend={g.say} /></div>}
        {g.error && <p role="alert" className="text-sm text-red-500">{g.error}</p>}
        {!g.connected && uid && <p className="text-sm text-slate2">Reconnecting…</p>}
      </aside>

      <NewGameDialog open={dialog} onClose={() => setDialog(false)} onStart={(p) => { g.seek(p); setDialog(false); }} />
    </main>
  );
}

function Prompt({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ice p-2 text-sm dark:bg-[#17294F]">
      <span className="font-semibold">{text}</span>
      <span className="flex gap-1"><button className="btn-primary !px-3 !py-1" onClick={onYes}>Accept</button><button className="btn-quiet !px-3 !py-1" onClick={onNo}>Decline</button></span>
    </div>
  );
}
