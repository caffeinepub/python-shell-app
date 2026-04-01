import { SyntaxLine } from "@/components/SyntaxLine";
import { usePyodide } from "@/contexts/PyodideContext";
import { useActor } from "@/hooks/useActor";
import { BUILTINS, KEYWORDS } from "@/utils/pythonHighlight";
import { AlertCircle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

type OutputLineType = "input" | "output" | "error" | "system" | "continuation";

interface OutputLine {
  id: number;
  type: OutputLineType;
  text: string;
}

const LINE_COLOR: Record<OutputLineType, string> = {
  input: "text-term-output",
  output: "text-term-output",
  error: "text-term-error",
  system: "text-term-system",
  continuation: "text-term-output",
};

const ALL_SUGGESTIONS = [
  ...Array.from(KEYWORDS),
  ...Array.from(BUILTINS),
].sort();

function getCurrentWord(input: string): string {
  const m = input.match(/[a-zA-Z_]\w*$/);
  return m ? m[0] : "";
}

interface TerminalTabProps {
  onRegisterClear?: (fn: () => void) => void;
  fontSize?: number;
}

export function TerminalTab({
  onRegisterClear,
  fontSize = 14,
}: TerminalTabProps) {
  const { pyodide, isLoading, loadError } = usePyodide();
  const { actor } = useActor();

  const [lines, setLines] = useState<OutputLine[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [multiLineBuffer, setMultiLineBuffer] = useState<string[]>([]);
  const [isMultiLine, setIsMultiLine] = useState(false);

  // Suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);

  const lineIdRef = useRef(0);
  const isRunningRef = useRef(false);
  const pyodideRef = useRef<any>(null);
  const actorRef = useRef<any>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const welcomeShownRef = useRef(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  pyodideRef.current = pyodide;
  actorRef.current = actor;

  // Register clear function
  useEffect(() => {
    onRegisterClear?.(() => setLines([]));
  }, [onRegisterClear]);

  // Auto-scroll to bottom when lines change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll trigger
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Update suggestions as input changes
  useEffect(() => {
    const word = getCurrentWord(input);
    if (word.length >= 1) {
      const filtered = ALL_SUGGESTIONS.filter(
        (s) => s.startsWith(word) && s !== word,
      ).slice(0, 8);
      setSuggestions(filtered);
      setSelectedSuggestion(-1);
    } else {
      setSuggestions([]);
      setSelectedSuggestion(-1);
    }
  }, [input]);

  // Stable addLine using functional setState + ref counter
  const addLine = useCallback((type: OutputLineType, text: string) => {
    setLines((prev) => [...prev, { id: lineIdRef.current++, type, text }]);
  }, []);

  // Welcome message after Pyodide loads
  useEffect(() => {
    if (pyodide && !welcomeShownRef.current) {
      welcomeShownRef.current = true;
      const version = pyodide.version ?? "0.26.4";
      addLine("system", `Python 3.11 (Pyodide ${version})`);
      addLine(
        "system",
        "Interactive Python shell. Type code and press Enter to run.",
      );
      addLine(
        "system",
        "Shift+Enter for multi-line blocks  ·  Ctrl+L to clear",
      );
      addLine("system", "");
    }
  }, [pyodide, addLine]);

  // Stable execute function that reads live values via refs
  const handleExecute = useCallback(
    async (code: string) => {
      if (!pyodideRef.current || isRunningRef.current) return;
      isRunningRef.current = true;
      setIsRunning(true);

      pyodideRef.current.setStdout({
        batched: (text: string) => {
          const clean = text.endsWith("\n") ? text.slice(0, -1) : text;
          if (clean !== "") addLine("output", clean);
        },
      });
      pyodideRef.current.setStderr({
        batched: (text: string) => {
          const clean = text.endsWith("\n") ? text.slice(0, -1) : text;
          if (clean !== "") addLine("error", clean);
        },
      });

      try {
        const result = await pyodideRef.current.runPythonAsync(code);
        if (result !== undefined && result !== null) {
          addLine("output", String(result));
        }
      } catch (e: any) {
        const msg: string = e?.message ?? String(e);
        addLine("error", msg);
      } finally {
        isRunningRef.current = false;
        setIsRunning(false);
        inputRef.current?.focus();
      }

      // Fire-and-forget backend command storage
      actorRef.current?.storeCommand(code).catch(console.warn);
    },
    [addLine],
  );

  const acceptSuggestion = (suggestion: string) => {
    const word = getCurrentWord(input);
    const newInput = input.slice(0, input.length - word.length) + suggestion;
    setInput(newInput);
    setSuggestions([]);
    setSelectedSuggestion(-1);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+L: clear terminal
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
      return;
    }

    // ESC: close suggestions
    if (e.key === "Escape") {
      setSuggestions([]);
      setSelectedSuggestion(-1);
      return;
    }

    // Navigate suggestions with arrow keys when visible
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        return;
      }
    }

    // Tab: accept suggestion or insert spaces
    if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length > 0) {
        const idx = selectedSuggestion >= 0 ? selectedSuggestion : 0;
        acceptSuggestion(suggestions[idx]);
      } else {
        setInput((prev) => `${prev}    `);
      }
      return;
    }

    // Shift+Enter: force multi-line mode
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      const cur = input;
      if (!isMultiLine) {
        addLine("input", cur);
        setMultiLineBuffer([cur]);
        setIsMultiLine(true);
      } else {
        addLine("continuation", cur);
        setMultiLineBuffer((prev) => [...prev, cur]);
      }
      setInput("");
      setSuggestions([]);
      return;
    }

    // Enter: run or continue
    if (e.key === "Enter") {
      e.preventDefault();
      setSuggestions([]);
      const cur = input;

      if (isMultiLine) {
        if (cur === "") {
          addLine("continuation", "");
          const code = multiLineBuffer.join("\n");
          setMultiLineBuffer([]);
          setIsMultiLine(false);
          setInput("");
          await handleExecute(code);
        } else {
          addLine("continuation", cur);
          setMultiLineBuffer((prev) => [...prev, cur]);
          setInput("");
        }
        return;
      }

      if (cur.trim() === "") return;

      setHistory((prev) => [cur, ...prev.slice(0, 99)]);
      setHistoryIndex(-1);
      addLine("input", cur);
      setInput("");

      const trimmed = cur.trimEnd();
      if (trimmed.endsWith(":") || trimmed.endsWith("\\")) {
        setMultiLineBuffer([cur]);
        setIsMultiLine(true);
      } else {
        await handleExecute(cur);
      }
      return;
    }

    // Arrow up/down: history (only when no suggestions)
    if (suggestions.length === 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length > 0 && historyIndex < history.length - 1) {
          const idx = historyIndex + 1;
          setHistoryIndex(idx);
          setInput(history[idx]);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > 0) {
          const idx = historyIndex - 1;
          setHistoryIndex(idx);
          setInput(history[idx]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInput("");
        }
        return;
      }
    }
  };

  const prompt = isMultiLine ? "... " : ">>> ";

  return (
    <div
      className="flex flex-col h-full bg-background"
      onClick={() => inputRef.current?.focus()}
      onKeyDown={() => inputRef.current?.focus()}
      role="presentation"
      style={{ cursor: "text" }}
    >
      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 font-mono leading-relaxed scrollbar-ide"
        style={{ minHeight: 0, fontSize: `${fontSize}px` }}
      >
        <AnimatePresence initial={false}>
          {isLoading && !loadError && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 text-term-system mb-2"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              <span>Loading Python 3.11 (Pyodide 0.26.4)…</span>
            </motion.div>
          )}

          {loadError && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-start gap-2 text-term-error mb-2"
            >
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{loadError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {lines.map((line) => (
          <div
            key={line.id}
            className={`${LINE_COLOR[line.type]} whitespace-pre-wrap break-all min-h-[1.2em]`}
          >
            {line.type === "input" && (
              <>
                <span className="text-term-prompt select-none">
                  &gt;&gt;&gt;{" "}
                </span>
                <SyntaxLine code={line.text} />
              </>
            )}
            {line.type === "continuation" && (
              <>
                <span className="text-term-prompt select-none">... </span>
                <SyntaxLine code={line.text} />
              </>
            )}
            {(line.type === "output" ||
              line.type === "error" ||
              line.type === "system") &&
              line.text}
          </div>
        ))}
      </div>

      {/* Input row */}
      <div className="shrink-0 border-t border-border">
        <div
          className="relative flex items-center px-4 py-2 font-mono"
          style={{ fontSize: `${fontSize}px` }}
        >
          <span
            className="text-term-prompt select-none shrink-0 mr-1"
            aria-hidden="true"
          >
            {prompt}
          </span>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="terminal-input"
              style={{ fontSize: `${fontSize}px` }}
              disabled={isLoading || isRunning}
              placeholder={
                isLoading ? "Loading Python..." : isRunning ? "Running..." : ""
              }
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              aria-label="Python input"
              data-ocid="terminal.input"
            />

            {/* Suggestion dropdown */}
            {suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute bottom-full left-0 mb-1 z-50 min-w-[180px] max-w-xs overflow-hidden rounded border border-border"
                style={{
                  background: "#1e1e1e",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
                }}
                data-ocid="terminal.popover"
              >
                {suggestions.map((s, i) => {
                  const word = getCurrentWord(input);
                  const isSelected = i === selectedSuggestion;
                  return (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        acceptSuggestion(s);
                      }}
                      className="w-full text-left px-3 py-1 text-xs font-mono transition-colors"
                      style={{
                        background: isSelected
                          ? "rgba(38,198,200,0.15)"
                          : "transparent",
                        color: isSelected ? "#26C6C8" : "#D4D4D4",
                        borderLeft: isSelected
                          ? "2px solid #26C6C8"
                          : "2px solid transparent",
                      }}
                      data-ocid={`terminal.item.${i + 1}`}
                    >
                      <span style={{ color: "#569CD6", fontWeight: 700 }}>
                        {s.slice(0, word.length)}
                      </span>
                      <span>{s.slice(word.length)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isRunning && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary ml-2 shrink-0" />
          )}
        </div>

        {/* Shortcuts hint */}
        <div className="flex items-center gap-4 px-4 pb-2 text-xs text-term-system select-none">
          <span>
            <kbd className="opacity-60">Enter</kbd> run
          </span>
          <span>
            <kbd className="opacity-60">Shift+Enter</kbd> new line
          </span>
          <span>
            <kbd className="opacity-60">Tab</kbd> autocomplete
          </span>
          <span>
            <kbd className="opacity-60">↑↓</kbd> history
          </span>
          <span>
            <kbd className="opacity-60">Ctrl+L</kbd> clear
          </span>
          {isMultiLine && (
            <span className="text-primary font-medium">
              multi-line · empty line to run
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
