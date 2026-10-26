export default function GameResult({ winner, color, reason, delta, onNew, onClose }: { winner: "w" | "b" | "draw"; color: "w" | "b" | null; reason: string; delta?: number; onNew: () => void; onClose: () => void }) {
  const outcome = winner === "draw" ? "Draw" : !color ? (winner === "w" ? "White wins" : "Black wins") : winner === color ? "You won" : "You lost";
  const tone = outcome === "You won" ? "text-emerald-600" : outcome === "You lost" ? "text-red-500" : "text-azure";
  return (
    <div role="dialog" aria-label="Game result" className="absolute inset-0 z-20 flex items-center justify-center bg-navy/55 backdrop-blur-[2px]">
      <div className="panel w-72 p-6 text-center shadow-xl">
        <h2 className={`text-3xl font-bold ${tone}`}>{outcome}</h2>
        <p className="mt-1 capitalize text-slate2">by {reason}</p>
        {!!delta && <p className="mt-3 text-lg font-semibold text-gold">{delta > 0 ? "+" : ""}{delta} rating</p>}
        <div className="mt-5 flex gap-2"><button className="btn-primary flex-1" onClick={onNew}>New game</button><button className="btn-quiet flex-1" onClick={onClose}>Review</button></div>
      </div>
    </div>
  );
}
