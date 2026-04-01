import { usePyodide } from "@/contexts/PyodideContext";
import { AlertCircle, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

export interface OutputLine {
  id: number;
  type: "out" | "err" | "info";
  text: string;
}

interface OutputPanelProps {
  lines: OutputLine[];
  runStatus: "idle" | "running" | "success" | "error";
  runDuration: number | null;
  onClear: () => void;
  fontSize?: number;
}

export function OutputPanel({
  lines,
  runStatus,
  runDuration,
  onClear,
  fontSize = 14,
}: OutputPanelProps) {
  const { isLoading: pyLoading, loadingMessage } = usePyodide();
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll trigger
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "oklch(var(--background))" }}
    >
      <div
        className="flex items-center justify-between px-3 h-8 shrink-0 border-b border-border"
        style={{ background: "oklch(var(--ide-header))" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">
            Output
          </span>
          {runStatus === "running" && (
            <span className="flex items-center gap-1 text-xs text-accent">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running…
            </span>
          )}
          {runStatus === "success" && runDuration !== null && (
            <span
              className="text-xs text-term-builtin"
              data-ocid="output.success_state"
            >
              ✓ Finished in {runDuration.toFixed(2)}s
            </span>
          )}
          {runStatus === "error" && (
            <span
              className="flex items-center gap-1 text-xs text-term-error"
              data-ocid="output.error_state"
            >
              <AlertCircle className="w-3 h-3" /> Error
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Clear output"
          data-ocid="output.close_button"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-ide p-3 font-mono leading-relaxed"
        style={{ fontSize: `${fontSize}px` }}
        data-ocid="output.panel"
      >
        <AnimatePresence initial={false}>
          {pyLoading && (
            <motion.div
              key="py-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-muted-foreground mb-3"
              data-ocid="output.loading_state"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              <span>{loadingMessage ?? "Loading Python 3.11…"}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {lines.length === 0 && !pyLoading && runStatus === "idle" && (
          <p
            className="text-muted-foreground text-xs"
            data-ocid="output.empty_state"
          >
            Run your script to see output here.
          </p>
        )}

        {lines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-all min-h-[1.4em] ${
              line.type === "err"
                ? "text-term-error"
                : line.type === "info"
                  ? "text-muted-foreground"
                  : "text-term-output"
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
