import { HighlightedEditor } from "@/components/HighlightedEditor";
import { useActor } from "@/hooks/useActor";
import { useGetScript, useInvalidateScripts } from "@/hooks/useQueries";
import { CALLTIPS } from "@/utils/pythonCalltips";
import {
  ALL_COMPLETIONS,
  extractUserDefinedNames,
} from "@/utils/pythonCompletions";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

export interface EditorPanelRef {
  getCode: () => string;
  triggerSave: () => void;
}

interface EditorPanelProps {
  selectedFile: string | null;
  filename: string;
  onFilenameChange: (name: string) => void;
  onFileSaved: (name: string) => void;
  fontSize?: number;
  fontFamily?: string;
  indentSize?: number;
}

const BRACKET_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
};

const CLOSING_CHARS = new Set([")", "]", "}", '"', "'"]);

function getCompletions(code: string, word: string): string[] {
  if (!word) return [];
  const userNames = extractUserDefinedNames(code);
  const all = [...new Set([...ALL_COMPLETIONS, ...userNames])];
  return all.filter((s) => s.startsWith(word) && s !== word).slice(0, 8);
}

function getCurrentWord(text: string, pos: number): string {
  const before = text.slice(0, pos);
  const m = before.match(/[a-zA-Z_]\w*$/);
  return m ? m[0] : "";
}

export const EditorPanel = forwardRef<EditorPanelRef, EditorPanelProps>(
  function EditorPanel(
    {
      selectedFile,
      filename,
      onFilenameChange,
      onFileSaved,
      fontSize = 14,
      fontFamily,
      indentSize = 4,
    },
    ref,
  ) {
    const { actor } = useActor();
    const queryClient = useQueryClient();
    const invalidateScripts = useInvalidateScripts();
    const { data: scriptData, isLoading: isLoadingFile } =
      useGetScript(selectedFile);
    const [localContent, setLocalContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const editorRef = useRef<HTMLTextAreaElement>(null);

    // Autocomplete state
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
    const [calltip, setCalltip] = useState<string | null>(null);

    // Find & Replace
    const [findOpen, setFindOpen] = useState(false);
    const [findText, setFindText] = useState("");
    const [replaceText, setReplaceText] = useState("");
    const [matchIndex, setMatchIndex] = useState(0);
    const findInputRef = useRef<HTMLInputElement>(null);

    // Go to line
    const [gotoOpen, setGotoOpen] = useState(false);
    const [gotoLine, setGotoLine] = useState("");
    const gotoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (scriptData) {
        setLocalContent(scriptData.content);
        onFilenameChange(scriptData.name);
      }
    }, [scriptData, onFilenameChange]);

    // Update completions as content/cursor changes
    const updateCompletions = useCallback((text: string, cursorPos: number) => {
      const word = getCurrentWord(text, cursorPos);
      if (word.length >= 1) {
        setSuggestions(getCompletions(text, word));
        setSelectedSuggestion(-1);
      } else {
        setSuggestions([]);
        setSelectedSuggestion(-1);
      }
    }, []);

    const handleSave = async () => {
      if (!actor) {
        toast.error("Not connected to backend");
        return;
      }
      const name = filename.trim().endsWith(".py")
        ? filename.trim()
        : `${filename.trim()}.py`;
      setIsSaving(true);
      try {
        await actor.saveScript(name, { content: localContent });
        onFilenameChange(name);
        invalidateScripts();
        queryClient.invalidateQueries({ queryKey: ["script", name] });
        onFileSaved(name);
        toast.success(`Saved ${name}`);
      } catch (e: any) {
        toast.error(e?.message ?? "Save failed");
      } finally {
        setIsSaving(false);
      }
    };

    const handleSaveRef = useRef(handleSave);
    handleSaveRef.current = handleSave;

    useImperativeHandle(ref, () => ({
      getCode: () => localContent,
      triggerSave: () => handleSaveRef.current(),
    }));

    const acceptSuggestion = useCallback(
      (suggestion: string) => {
        const ta = editorRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const word = getCurrentWord(localContent, pos);
        const before = localContent.slice(0, pos - word.length);
        const after = localContent.slice(pos);
        const newContent = `${before}${suggestion}${after}`;
        setLocalContent(newContent);
        setSuggestions([]);
        setSelectedSuggestion(-1);
        requestAnimationFrame(() => {
          if (ta) {
            const newPos = pos - word.length + suggestion.length;
            ta.selectionStart = newPos;
            ta.selectionEnd = newPos;
            ta.focus();
          }
        });
      },
      [localContent],
    );

    const findMatches = useCallback((text: string, query: string) => {
      if (!query) return [];
      const indices: number[] = [];
      let i = 0;
      // biome-ignore lint/suspicious/noAssignInExpressions: search loop
      while ((i = text.indexOf(query, i)) !== -1) {
        indices.push(i);
        i += query.length;
      }
      return indices;
    }, []);

    const handleFindNext = useCallback(() => {
      if (!findText) return;
      const matches = findMatches(localContent, findText);
      if (matches.length === 0) {
        toast.info("No matches found");
        return;
      }
      const idx = (matchIndex + 1) % matches.length;
      setMatchIndex(idx);
      const ta = editorRef.current;
      if (ta) {
        ta.focus();
        ta.selectionStart = matches[idx];
        ta.selectionEnd = matches[idx] + findText.length;
      }
    }, [findText, localContent, matchIndex, findMatches]);

    const handleReplace = useCallback(() => {
      if (!findText) return;
      const matches = findMatches(localContent, findText);
      if (matches.length === 0) return;
      const idx = matchIndex % matches.length;
      const pos = matches[idx];
      const newContent =
        localContent.slice(0, pos) +
        replaceText +
        localContent.slice(pos + findText.length);
      setLocalContent(newContent);
    }, [findText, replaceText, localContent, matchIndex, findMatches]);

    const handleReplaceAll = useCallback(() => {
      if (!findText) return;
      const count = localContent.split(findText).length - 1;
      const newContent = localContent.split(findText).join(replaceText);
      setLocalContent(newContent);
      toast.success(`Replaced ${count} occurrence${count !== 1 ? "s" : ""}`);
    }, [findText, replaceText, localContent]);

    const handleGotoLine = useCallback(() => {
      const lineNum = Number.parseInt(gotoLine, 10);
      if (Number.isNaN(lineNum) || lineNum < 1) return;
      const lines = localContent.split("\n");
      const targetLine = Math.min(lineNum, lines.length);
      let pos = 0;
      for (let i = 0; i < targetLine - 1; i++) {
        pos += lines[i].length + 1;
      }
      const ta = editorRef.current;
      if (ta) {
        ta.focus();
        ta.selectionStart = pos;
        ta.selectionEnd = pos + lines[targetLine - 1].length;
      }
      setGotoOpen(false);
      setGotoLine("");
    }, [gotoLine, localContent]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const indent = " ".repeat(indentSize);

      // Close find/goto on Escape
      if (e.key === "Escape") {
        if (findOpen) {
          setFindOpen(false);
          return;
        }
        if (gotoOpen) {
          setGotoOpen(false);
          return;
        }
        setSuggestions([]);
        return;
      }

      // Open Find & Replace
      if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => findInputRef.current?.focus(), 50);
        return;
      }

      // Go to Line
      if (e.key === "g" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setGotoOpen(true);
        setTimeout(() => gotoInputRef.current?.focus(), 50);
        return;
      }

      // Save
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSaveRef.current();
        return;
      }

      // Navigate autocomplete suggestions
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
        if (e.key === "Enter" || (e.key === "Tab" && suggestions.length > 0)) {
          e.preventDefault();
          const idx = selectedSuggestion >= 0 ? selectedSuggestion : 0;
          acceptSuggestion(suggestions[idx]);
          return;
        }
      }

      // Tab: indent
      if (e.key === "Tab") {
        e.preventDefault();
        const next = `${localContent.substring(0, start)}${indent}${localContent.substring(end)}`;
        setLocalContent(next);
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.selectionStart = start + indentSize;
            editorRef.current.selectionEnd = start + indentSize;
          }
        });
        return;
      }

      // Skip over closing bracket
      if (CLOSING_CHARS.has(e.key) && start === end) {
        const nextChar = localContent[start];
        if (nextChar === e.key) {
          e.preventDefault();
          requestAnimationFrame(() => {
            if (editorRef.current) {
              editorRef.current.selectionStart = start + 1;
              editorRef.current.selectionEnd = start + 1;
            }
          });
          return;
        }
      }

      // Auto-closing brackets
      if (BRACKET_PAIRS[e.key]) {
        e.preventDefault();
        const closing = BRACKET_PAIRS[e.key];
        const before = localContent.substring(0, start);
        const selected = localContent.substring(start, end);
        const after = localContent.substring(end);
        const nextChar = after[0];
        // Don't double-close if already followed by same closer (and nothing selected)
        const shouldClose = selected.length > 0 || nextChar !== closing;
        const newContent = shouldClose
          ? `${before}${e.key}${selected}${closing}${after}`
          : `${before}${e.key}${after}`;
        setLocalContent(newContent);
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.selectionStart = start + 1;
            editorRef.current.selectionEnd = start + 1 + selected.length;
          }
        });
        // Show calltip after (
        if (e.key === "(") {
          const word = getCurrentWord(localContent, start);
          if (word && CALLTIPS[word]) {
            setCalltip(CALLTIPS[word]);
            setTimeout(() => setCalltip(null), 4000);
          }
        }
        return;
      }

      // Backspace: delete pair
      if (e.key === "Backspace" && start === end && start > 0) {
        const prevChar = localContent[start - 1];
        const nextChar = localContent[start];
        if (prevChar in BRACKET_PAIRS && BRACKET_PAIRS[prevChar] === nextChar) {
          e.preventDefault();
          const newContent =
            localContent.substring(0, start - 1) +
            localContent.substring(start + 1);
          setLocalContent(newContent);
          requestAnimationFrame(() => {
            if (editorRef.current) {
              editorRef.current.selectionStart = start - 1;
              editorRef.current.selectionEnd = start - 1;
            }
          });
          return;
        }
      }

      // Enter: auto-indent
      if (e.key === "Enter") {
        e.preventDefault();
        const beforeCursor = localContent.substring(0, start);
        const afterCursor = localContent.substring(end);
        const lastLine = beforeCursor.split("\n").pop() ?? "";
        const indentMatch = lastLine.match(/^(\s*)/);
        const currentIndent = indentMatch ? indentMatch[1] : "";
        const extraIndent = lastLine.trimEnd().endsWith(":") ? indent : "";
        const newContent = `${beforeCursor}\n${currentIndent}${extraIndent}${afterCursor}`;
        setLocalContent(newContent);
        setSuggestions([]);
        requestAnimationFrame(() => {
          if (editorRef.current) {
            const pos = start + 1 + currentIndent.length + extraIndent.length;
            editorRef.current.selectionStart = pos;
            editorRef.current.selectionEnd = pos;
          }
        });
        return;
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalContent(e.target.value);
      updateCompletions(e.target.value, e.target.selectionStart);
    };

    const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      updateCompletions(localContent, ta.selectionStart);
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      if (!["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(e.key)) {
        updateCompletions(localContent, ta.selectionStart);
      }
    };

    const lineCount = localContent ? localContent.split("\n").length : 1;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join(
      "\n",
    );

    const matches = findText ? findMatches(localContent, findText) : [];
    const currentMatchNum =
      matches.length > 0 ? (matchIndex % matches.length) + 1 : 0;

    const monoFamily = fontFamily
      ? `${fontFamily}, monospace`
      : "'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace";

    if (isLoadingFile) {
      return (
        <div className="flex-1 flex items-center justify-center bg-card">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <div className="flex flex-1 overflow-hidden min-h-0 bg-card relative">
        <div
          className="line-numbers select-none shrink-0 border-r border-border"
          style={{ fontSize: `${fontSize}px`, minWidth: "3rem" }}
          aria-hidden
        >
          {lineNumbers}
        </div>

        {/* Calltip */}
        {calltip && (
          <div
            className="absolute top-2 left-16 right-4 z-20 px-3 py-1.5 rounded text-xs font-mono border border-border"
            style={{
              background: "#252540",
              color: "#FFD43B",
              borderColor: "#3776AB",
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
            data-ocid="editor.tooltip"
          >
            {calltip}
          </div>
        )}

        {/* Find & Replace toolbar */}
        {findOpen && (
          <div
            className="absolute top-0 right-0 z-30 flex flex-col gap-1 p-2 border border-border rounded-bl shadow-lg"
            style={{ background: "#1a1a2e", minWidth: 340 }}
            data-ocid="find.panel"
          >
            <div className="flex items-center gap-1.5">
              <input
                ref={findInputRef}
                type="text"
                placeholder="Find..."
                value={findText}
                onChange={(e) => {
                  setFindText(e.target.value);
                  setMatchIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFindNext();
                  if (e.key === "Escape") setFindOpen(false);
                }}
                className="flex-1 px-2 py-1 text-xs rounded border border-border bg-card text-foreground outline-none"
                style={{ fontFamily: monoFamily }}
                data-ocid="find.input"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {matches.length > 0
                  ? `${currentMatchNum}/${matches.length}`
                  : "0/0"}
              </span>
              <button
                type="button"
                onClick={handleFindNext}
                className="px-2 py-1 text-xs rounded bg-primary/20 hover:bg-primary/30 text-primary"
                data-ocid="find.secondary_button"
              >
                Next
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Replace..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setFindOpen(false);
                }}
                className="flex-1 px-2 py-1 text-xs rounded border border-border bg-card text-foreground outline-none"
                style={{ fontFamily: monoFamily }}
                data-ocid="find.textarea"
              />
              <button
                type="button"
                onClick={handleReplace}
                className="px-2 py-1 text-xs rounded bg-primary/20 hover:bg-primary/30 text-primary"
                data-ocid="find.primary_button"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                className="px-2 py-1 text-xs rounded bg-primary/20 hover:bg-primary/30 text-primary"
                data-ocid="find.confirm_button"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFindOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-muted-foreground"
                data-ocid="find.close_button"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Go to line overlay */}
        {gotoOpen && (
          <div
            className="absolute top-0 right-0 z-30 flex items-center gap-2 p-2 border border-border rounded-bl shadow-lg"
            style={{ background: "#1a1a2e" }}
            data-ocid="goto.panel"
          >
            <span className="text-xs text-muted-foreground">Go to line:</span>
            <input
              ref={gotoInputRef}
              type="number"
              min={1}
              value={gotoLine}
              onChange={(e) => setGotoLine(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGotoLine();
                if (e.key === "Escape") {
                  setGotoOpen(false);
                  setGotoLine("");
                }
              }}
              className="w-20 px-2 py-1 text-xs rounded border border-border bg-card text-foreground outline-none"
              data-ocid="goto.input"
            />
            <button
              type="button"
              onClick={handleGotoLine}
              className="px-2 py-1 text-xs rounded bg-primary/20 hover:bg-primary/30 text-primary"
              data-ocid="goto.primary_button"
            >
              Go
            </button>
            <button
              type="button"
              onClick={() => {
                setGotoOpen(false);
                setGotoLine("");
              }}
              className="p-1 rounded hover:bg-white/10 text-muted-foreground"
              data-ocid="goto.close_button"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div
            className="absolute bottom-8 left-14 z-20 min-w-[180px] max-w-xs overflow-hidden rounded border border-border"
            style={{
              background: "#1e1e1e",
              boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
            }}
            data-ocid="editor.popover"
          >
            {suggestions.map((s, i) => {
              const ta = editorRef.current;
              const pos = ta?.selectionStart ?? 0;
              const word = getCurrentWord(localContent, pos);
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
                    fontFamily: monoFamily,
                    fontSize: `${fontSize - 1}px`,
                  }}
                  data-ocid={`editor.item.${i + 1}`}
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

        <HighlightedEditor
          ref={editorRef}
          value={localContent}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onKeyUp={handleKeyUp}
          placeholder={"# Write Python code here\nprint('Hello, World!')"}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          data-ocid="editor.textarea"
          fontSize={fontSize}
          fontFamily={fontFamily}
          style={{ flex: 1, minHeight: 0 }}
        />
        {isSaving && (
          <div className="absolute bottom-3 right-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
      </div>
    );
  },
);
