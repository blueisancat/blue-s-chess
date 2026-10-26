/** Synthesised sounds (no assets). Swap for sampled sound themes later. */
let ctx: AudioContext | null = null;
const tones = { move: [440, 0.05], capture: [300, 0.09], check: [660, 0.12], low: [880, 0.06], end: [220, 0.3] } as const;
export function play(kind: keyof typeof tones, volume = 0.15) {
  try {
    ctx ??= new AudioContext();
    const [freq, dur] = tones[kind];
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; o.type = kind === "capture" ? "triangle" : "sine";
    g.gain.setValueAtTime(volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  } catch { /* autoplay blocked or unsupported */ }
}
