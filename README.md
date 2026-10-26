# Blue Chess

Open-source chess platform. This repo is the **foundation**: architecture, schema, real-time game server, rating engine, and the interactive board. Remaining features are in the roadmap.

## Architecture

```
Browser (Next.js 15 App Router, TS, Tailwind, shadcn/ui)
 ├─ chessground (board) + chess.js (legal moves, client-side hints)
 ├─ Stockfish WASM in a Web Worker (analysis, offline-capable via service worker)
 └─ Socket: native WebSocket  ──►  Game server (Node, ws)
                                     ├─ chess.js / chessops authoritative rules
                                     ├─ Redis: matchmaking pools, live-game state, pub/sub
                                     └─ PostgreSQL (Prisma): users, games, ratings, puzzles…
Next.js route handlers: auth, REST (profiles, puzzles, clubs, forums, PGN import/export)
```

**Deviations, justified**
- *Separate game server* instead of Next.js sockets: Vercel can't hold long-lived WebSockets; the server deploys on Fly/Railway and scales horizontally via Redis pub/sub.
- *Native `ws`* instead of Socket.io: lower overhead, no custom protocol, easier to port to Go later.
- *Server is authoritative*: clients send moves, server validates, applies clocks, broadcasts. Clients never decide results.
- *chess.js* handles standard chess. Variants (Chess960 castling, Atomic, Crazyhouse, Horde…) should move to `chessops`, which supports all of them; the rules adapter in `server/src/rules.ts` (roadmap) isolates this.

## WebSocket protocol (JSON, `{t: type, ...}`)

Client → server
| type | payload |
|---|---|
| `seek` | `{base, inc, rated, variant, color}` join matchmaking |
| `seek_cancel` | |
| `join` | `{gameId}` join as player or spectator |
| `move` | `{gameId, uci}` |
| `resign` / `abort` | `{gameId}` |
| `draw_offer` / `draw_accept` / `draw_decline` | `{gameId}` |
| `takeback_offer` / `takeback_accept` / `takeback_decline` | `{gameId}` |
| `chat` | `{gameId, text}` |

Server → client
`hello`, `seeking`, `game_start`, `state` (full snapshot: fen, moves, clocks, status, spectators), `move`, `offer`, `chat`, `game_end` (result, reason, rating deltas), `error`.

## REST routes (Next.js)
`POST /api/auth/*` (NextAuth: credentials, Google, Discord) · `GET /api/users/:name` · `GET /api/games/:id` · `GET /api/games/:id/pgn` · `POST /api/games/import` · `GET /api/puzzles/next` · `POST /api/puzzles/:id/attempt` · `GET /api/puzzles/daily` · `GET /api/leaderboard?perf=blitz&country=` · `/api/clubs`, `/api/forums`, `/api/messages`, `/api/tournaments` · `/api/admin/*` (role-gated).

## Setup
```bash
cp .env.example .env
docker compose up -d postgres redis
npm i && npx prisma migrate dev --name init
npm run dev:server    # ws://localhost:4000
npm run dev:web       # http://localhost:3000
```
`.env.example`:
```
DATABASE_URL=postgresql://blue:blue@localhost:5432/bluechess
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=change-me
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= DISCORD_CLIENT_ID= DISCORD_CLIENT_SECRET=
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

## Design system
Palette: Navy `#0F2A5C`, Azure `#2F6BFF`, Ice `#EAF2FF`, Slate `#5B6B8C`, Gold `#F2B632` (rating gains, achievements only).
Board "Sapphire": light `#DCE7FA`, dark `#6C8EC9`. Type: Inter for UI, tabular numerals for clocks.
Dark mode swaps surfaces to deep blue-slate; a high-contrast theme raises board and text contrast.

## Roadmap
1. **Next (v0.2):** NextAuth wiring, game page UI (clocks, move list, chat), persist finished games, Redis-backed state and reconnection.
2. **v0.3:** Stockfish WASM analysis board, eval bar, PGN/FEN import-export, opening explorer.
3. **v0.4:** Puzzles (Lichess-style open DB import, Glicko-rated, daily, rush/storm), endgame practice via Syzygy tablebase API.
4. **v0.5:** Variants via chessops, daily/correspondence games (server-side deadlines + email/push), bots with personalities (Stockfish Skill Level + move-noise profiles).
5. **v0.6:** Profiles, friends, clubs, DMs, forums, leaderboards.
6. **v0.7:** Tournaments (Swiss with Dutch pairing, Arena, Round-robin), titles/badges.
7. **v0.8:** Lessons/courses, opening trainer with spaced repetition (SM-2), achievements.
8. **v1.0:** Admin panel, moderation and fair-play tooling, PWA/offline, a11y audit, load tests.

Not yet implemented: everything listed in roadmap items 2 to 8.
