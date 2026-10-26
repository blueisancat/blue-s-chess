/**
 * Blue Chess game server: authoritative real-time chess over WebSockets.
 * State is in-memory here; production swaps `games`/`pool` for Redis (see README roadmap).
 */
import { WebSocketServer, WebSocket } from "ws";
import { Chess } from "chess.js";
import { randomUUID } from "node:crypto";
import { update, type G2 } from "./glicko2.js";

type Color = "w" | "b";
interface Seek { id: string; ws: WebSocket; uid: string; base: number; inc: number; rated: boolean; color: "w" | "b" | "random" }
interface Game {
  id: string; chess: Chess; players: Record<Color, { uid: string; ws: WebSocket | null }>;
  spectators: Set<WebSocket>; clocks: Record<Color, number>; inc: number; base: number; rated: boolean;
  lastTick: number; status: "active" | "finished"; offers: { draw?: Color; takeback?: Color };
  timer?: NodeJS.Timeout;
}

const games = new Map<string, Game>();
const pool: Seek[] = [];
const ratings = new Map<string, G2>(); // placeholder for DB
const rate = (uid: string): G2 => ratings.get(uid) ?? { rating: 1500, rd: 350, vol: 0.06 };

const send = (ws: WebSocket | null, msg: object) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
const colorOf = (g: Game, uid: string): Color | null =>
  g.players.w.uid === uid ? "w" : g.players.b.uid === uid ? "b" : null;
const broadcast = (g: Game, msg: object) =>
  [g.players.w.ws, g.players.b.ws, ...g.spectators].forEach((w) => send(w, msg));

function snapshot(g: Game) {
  return {
    t: "state", gameId: g.id, fen: g.chess.fen(), history: g.chess.history({ verbose: true }).map((m) => m.lan),
    san: g.chess.history(), clocks: g.clocks, turn: g.chess.turn(), status: g.status,
    check: g.chess.inCheck(), offers: g.offers, spectators: g.spectators.size,
  };
}

/** Deduct elapsed time from the side to move; returns true if flagged. */
function tick(g: Game): boolean {
  const now = Date.now(), side = g.chess.turn();
  g.clocks[side] -= now - g.lastTick; g.lastTick = now;
  return g.clocks[side] <= 0;
}
function armTimer(g: Game) {
  clearTimeout(g.timer);
  if (g.status !== "active" || g.chess.history().length < 2) return; // clocks start after both sides moved
  g.timer = setTimeout(() => {
    if (tick(g)) end(g, g.chess.turn() === "w" ? "b" : "w", "timeout"); else armTimer(g);
  }, Math.max(g.clocks[g.chess.turn()], 0) + 20);
}

function end(g: Game, winner: Color | "draw", reason: string) {
  if (g.status === "finished") return;
  g.status = "finished"; clearTimeout(g.timer);
  const deltas: Record<Color, number> = { w: 0, b: 0 };
  if (g.rated && g.chess.history().length >= 2) {
    const w = rate(g.players.w.uid), b = rate(g.players.b.uid);
    const sw = winner === "draw" ? 0.5 : winner === "w" ? 1 : 0;
    const nw = update(w, b, sw), nb = update(b, w, 1 - sw);
    deltas.w = Math.round(nw.rating - w.rating); deltas.b = Math.round(nb.rating - b.rating);
    ratings.set(g.players.w.uid, nw); ratings.set(g.players.b.uid, nb);
  }
  broadcast(g, { t: "game_end", gameId: g.id, winner, reason, deltas, pgn: g.chess.pgn() });
  // TODO: persist Game + Rating rows via Prisma
}

function startGame(a: Seek, b: Seek) {
  const aWhite = a.color === "w" || (a.color === "random" && Math.random() < 0.5);
  const [w, bl] = aWhite ? [a, b] : [b, a];
  const g: Game = {
    id: randomUUID().slice(0, 8), chess: new Chess(),
    players: { w: { uid: w.uid, ws: w.ws }, b: { uid: bl.uid, ws: bl.ws } },
    spectators: new Set(), clocks: { w: a.base * 1000, b: a.base * 1000 }, base: a.base * 1000, inc: a.inc * 1000,
    rated: a.rated && b.rated, lastTick: Date.now(), status: "active", offers: {},
  };
  games.set(g.id, g);
  send(w.ws, { t: "game_start", gameId: g.id, color: "w" });
  send(bl.ws, { t: "game_start", gameId: g.id, color: "b" });
  broadcast(g, snapshot(g));
}

function onMessage(ws: WebSocket, uid: string, m: any) {
  const g: Game | undefined = m.gameId ? games.get(m.gameId) : undefined;
  const me = g ? colorOf(g, uid) : null;
  switch (m.t) {
    case "seek": {
      const base = Number(m.base), inc = Number(m.inc);
      if (!(base >= 15 && base <= 10800) || !(inc >= 0 && inc <= 180)) return send(ws, { t: "error", msg: "Invalid time control" });
      const i = pool.findIndex((s) => s.uid !== uid && s.base === base && s.inc === inc && s.rated === !!m.rated);
      const mine: Seek = { id: randomUUID(), ws, uid, base, inc, rated: !!m.rated, color: m.color ?? "random" };
      if (i >= 0) startGame(pool.splice(i, 1)[0], mine);
      else { pool.push(mine); send(ws, { t: "seeking" }); }
      return;
    }
    case "seek_cancel": { const i = pool.findIndex((s) => s.ws === ws); if (i >= 0) pool.splice(i, 1); return; }
    case "join": {
      if (!g) return send(ws, { t: "error", msg: "Game not found" });
      if (me) g.players[me].ws = ws; else g.spectators.add(ws); // reconnect or spectate
      return send(ws, snapshot(g));
    }
  }
  if (!g || g.status !== "active") return;
  switch (m.t) {
    case "move": {
      if (!me || g.chess.turn() !== me) return send(ws, { t: "error", msg: "Not your turn" });
      if (g.chess.history().length >= 2 && tick(g)) return end(g, me === "w" ? "b" : "w", "timeout");
      try {
        const uci = String(m.uci);
        g.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      } catch { return send(ws, { t: "error", msg: "Illegal move", resync: snapshot(g) }); }
      if (g.chess.history().length > 2) g.clocks[me] += g.inc;
      g.lastTick = Date.now(); g.offers = {};
      broadcast(g, snapshot(g));
      if (g.chess.isCheckmate()) return end(g, me, "checkmate");
      if (g.chess.isStalemate()) return end(g, "draw", "stalemate");
      if (g.chess.isInsufficientMaterial()) return end(g, "draw", "insufficient material");
      if (g.chess.isThreefoldRepetition()) return end(g, "draw", "repetition");
      if (g.chess.isDraw()) return end(g, "draw", "50-move rule");
      return armTimer(g);
    }
    case "resign": return me && end(g, me === "w" ? "b" : "w", "resignation");
    case "abort": return me && g.chess.history().length < 2 && end(g, "draw", "aborted");
    case "draw_offer": if (me) { g.offers.draw = me; broadcast(g, { t: "offer", kind: "draw", from: me }); } return;
    case "draw_accept": return me && g.offers.draw && g.offers.draw !== me && end(g, "draw", "agreement");
    case "draw_decline": delete g.offers.draw; return broadcast(g, snapshot(g));
    case "takeback_offer": if (me) { g.offers.takeback = me; broadcast(g, { t: "offer", kind: "takeback", from: me }); } return;
    case "takeback_accept":
      if (me && g.offers.takeback && g.offers.takeback !== me) {
        const requester = g.offers.takeback;
        g.chess.undo(); if (g.chess.turn() !== requester) g.chess.undo(); // requester moves again
        g.offers = {}; g.lastTick = Date.now(); armTimer(g); broadcast(g, snapshot(g));
      } return;
    case "chat": {
      const text = String(m.text ?? "").slice(0, 300);
      if (text) broadcast(g, { t: "chat", from: me ?? "spectator", text });
    }
  }
}

const wss = new WebSocketServer({ port: Number(process.env.PORT ?? 4000) });
wss.on("connection", (ws, req) => {
  // TODO: verify the NextAuth JWT (cookie or ?token=) and derive uid. Guest id for now.
  const uid = new URL(req.url ?? "/", "http://x").searchParams.get("uid") ?? `guest-${randomUUID().slice(0, 6)}`;
  send(ws, { t: "hello", uid });
  ws.on("message", (raw) => { try { onMessage(ws, uid, JSON.parse(String(raw))); } catch { send(ws, { t: "error", msg: "Bad message" }); } });
  ws.on("close", () => { const i = pool.findIndex((s) => s.ws === ws); if (i >= 0) pool.splice(i, 1); });
});
console.log("Blue Chess server on :" + (process.env.PORT ?? 4000));
