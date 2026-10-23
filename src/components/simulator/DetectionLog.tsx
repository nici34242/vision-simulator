import { ScrollText } from "lucide-react";
import { logStore, useStore } from "@/lib/simulator/store";
import type { LogEntry } from "@/lib/simulator/types";

const KIND_STYLE: Record<LogEntry["kind"], string> = {
  info: "text-muted-foreground",
  detect: "text-primary",
  lost: "text-amber-400",
  warn: "text-amber-400",
  error: "text-destructive",
  success: "text-emerald-400",
};

const KIND_PREFIX: Record<LogEntry["kind"], string> = {
  info: "·",
  detect: "◆",
  lost: "◇",
  warn: "!",
  error: "✕",
  success: "✓",
};

/** Live, capped detection log (newest first). */
export function DetectionLog() {
  const logs = useStore(logStore);

  return (
    <div className="rounded-lg border border-border/70 bg-card/50">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <ScrollText className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Detection log
        </h3>
      </div>
      <div className="max-h-48 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-5">
        {logs.length === 0 ? (
          <p className="text-muted-foreground">
            No events yet — start a capture to see detections, losses and model
            events here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {logs.map((entry) => (
              <li key={entry.id} className="flex gap-2">
                <span className="shrink-0 text-muted-foreground/70">
                  {entry.time}
                </span>
                <span className={`shrink-0 ${KIND_STYLE[entry.kind]}`}>
                  {KIND_PREFIX[entry.kind]}
                </span>
                <span className={KIND_STYLE[entry.kind]}>{entry.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
