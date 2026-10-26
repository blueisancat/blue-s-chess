"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatMsg } from "@/lib/useGameSocket";

const QUICK = ["Good luck!", "Good game", "Thanks", "Nice move"];

export default function Chat({ messages, myColor, onSend, disabled }: { messages: ChatMsg[]; myColor: "w" | "b" | null; onSend: (t: string) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);
  const who = (f: string) => (f === "spectator" ? "Spectator" : f === myColor ? "You" : "Opponent");
  const submit = (t: string) => { const v = t.trim(); if (v) { onSend(v); setText(""); } };
  return (
    <div className="flex h-56 flex-col">
      <div className="flex-1 space-y-1 overflow-y-auto p-3 text-sm" aria-live="polite">
        {messages.map((m, i) => (
          <p key={i}><span className={`font-semibold ${m.from === myColor ? "text-azure" : ""}`}>{who(m.from)}: </span>{m.text}</p>
        ))}
        <div ref={end} />
      </div>
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {QUICK.map((q) => <button key={q} disabled={disabled} onClick={() => submit(q)} className="rounded-full bg-ice px-2 py-0.5 text-xs hover:bg-[#D6E4FF] disabled:opacity-40 dark:bg-[#17294F]">{q}</button>)}
      </div>
      <input value={text} disabled={disabled} maxLength={300} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit(text)}
        placeholder={myColor ? "Message your opponent" : "Chat as a spectator"} aria-label="Chat message"
        className="m-3 mt-0 rounded-lg border border-[#C5D6F5] bg-transparent px-3 py-2 text-sm outline-none focus:border-azure dark:border-[#2A4378]" />
    </div>
  );
}
