"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type C = "w" | "b";
export interface GameState {
  gameId: string; fen: string; san: string[]; clocks: Record<C, number>; turn: C; status: "active" | "finished";
  check: boolean; offers: { draw?: C; takeback?: C }; spectators: number;
  players: Record<C, { uid: string; rating: number }>; rated: boolean; base: number; inc: number;
  variant: string; startFen?: string; at: number; // `at`: client receive time, for clock interpolation
}
export interface GameResultMsg { winner: C | "draw"; reason: string; deltas: Record<C, number>; pgn: string }
export interface ChatMsg { from: string; text: string }
export interface SeekParams { base: number; inc: number; rated: boolean; color: "w" | "b" | "random"; variant: string }

export function useGuestId() {
  const [id, setId] = useState("");
  useEffect(() => {
    let v = localStorage.getItem("bc_uid");
    if (!v) { v = "guest-" + Math.random().toString(36).slice(2, 8); localStorage.setItem("bc_uid", v); }
    setId(v);
  }, []);
  return id;
}

/** Reconnecting game socket. Server is authoritative; illegal moves resync the board. */
export function useGameSocket(uid: string, watchId?: string) {
  const ws = useRef<WebSocket>();
  const gameRef = useRef<string | null>(watchId ?? null);
  const [connected, setConnected] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [result, setResult] = useState<GameResultMsg | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let closed = false, retry = 0;
    const open = () => {
      const s = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}?uid=${encodeURIComponent(uid)}`);
      ws.current = s;
      s.onopen = () => { setConnected(true); retry = 0; if (gameRef.current) s.send(JSON.stringify({ t: "join", gameId: gameRef.current })); };
      s.onclose = () => { setConnected(false); if (!closed) setTimeout(open, Math.min(1000 * 2 ** retry++, 8000)); };
      s.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === "seeking") setSeeking(true);
        if (m.t === "game_start") { gameRef.current = m.gameId; setSeeking(false); setResult(null); setChat([]); setState(null); }
        if (m.t === "state" && m.gameId === gameRef.current) setState({ ...m, at: Date.now() });
        if (m.t === "game_end") setResult(m);
        if (m.t === "chat") setChat((c) => [...c, { from: m.from, text: m.text }]);
        if (m.t === "error") { setError(m.msg); if (m.resync) setState({ ...m.resync, at: Date.now() }); }
      };
    };
    open();
    return () => { closed = true; ws.current?.close(); };
  }, [uid]);

  const send = useCallback((msg: object) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(msg)), []);
  const color: C | null = useMemo(
    () => (state ? (state.players.w.uid === uid ? "w" : state.players.b.uid === uid ? "b" : null) : null), [state, uid]);
  const gid = () => gameRef.current;

  return {
    connected, seeking, state, result, chat, color, error, uid,
    seek: (p: SeekParams) => send({ t: "seek", ...p }),
    cancelSeek: () => { send({ t: "seek_cancel" }); setSeeking(false); },
    move: (uci: string) => send({ t: "move", gameId: gid(), uci }),
    act: (t: "resign" | "abort" | "draw_offer" | "draw_accept" | "draw_decline" | "takeback_offer" | "takeback_accept" | "takeback_decline") =>
      send({ t, gameId: gid() }),
    say: (text: string) => send({ t: "chat", gameId: gid(), text }),
  };
}
