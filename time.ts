export type Category = "bullet" | "blitz" | "rapid" | "classical" | "daily";
/** Lichess-style estimate: base + 40 × increment (seconds). */
export function categoryFor(base: number, inc: number): Category {
  const est = base + 40 * inc;
  return est < 180 ? "bullet" : est < 480 ? "blitz" : est < 1500 ? "rapid" : "classical";
}
export const PRESETS: Record<Exclude<Category, "daily">, [number, number][]> = {
  bullet: [[60, 0], [60, 1], [120, 1]],
  blitz: [[180, 0], [180, 2], [300, 0], [300, 3]],
  rapid: [[600, 0], [900, 10], [1800, 0]],
  classical: [[3600, 0], [5400, 30]],
};
export const tcLabel = (base: number, inc: number) => `${base % 60 ? (base / 60).toFixed(1) : base / 60}+${inc}`;
/** m:ss, or s.t under 10 seconds. */
export function formatClock(ms: number) {
  const t = Math.max(ms, 0);
  if (t < 10_000) return (t / 1000).toFixed(1);
  const s = Math.floor(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
