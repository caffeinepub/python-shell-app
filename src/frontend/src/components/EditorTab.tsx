import { HighlightedEditor } from "@/components/HighlightedEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePyodide } from "@/contexts/PyodideContext";
import { useActor } from "@/hooks/useActor";
import { useGetScript, useInvalidateScripts } from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Play,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface EditorTabProps {
  selectedFile: string | null;
  onFileSaved: (name: string) => void;
  onRegisterSave?: (fn: () => void) => void;
  fontSize?: number;
}

type RunStatus = "idle" | "running" | "success" | "error";

interface OutputLine {
  id: number;
  type: "out" | "err";
  text: string;
}

export function EditorTab({
  selectedFile,
  onFileSaved,
  onRegisterSave,
  fontSize = 14,
}: EditorTabProps) {
  const { pyodide, isLoading: pyodideLoading } = usePyodide();
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const invalidateScripts = useInvalidateScripts();

  const { data: scriptData, isLoading: isLoadingFile } =
    useGetScript(selectedFile);

  const [localContent, setLocalContent] = useState<string | null>(null);
  const [localFilename, setLocalFilename] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const pyodideRef = useRef<any>(null);
  const outputIdRef = useRef(0);
  pyodideRef.current = pyodide;

  // Sync server data into local state when file loads
  useEffect(() => {
    if (scriptData) {
      setLocalContent(scriptData.content);
      setLocalFilename(scriptData.name);
    }
  }, [scriptData]);

  // Scroll output panel to bottom on new lines
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll trigger
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines]);

  const editorContent = localContent ?? "";
  const filename = localFilename ?? selectedFile ?? "untitled.py";

  const addOutputLine = (type: "out" | "err", text: string) => {
    setOutputLines((prev) => [
      ...prev,
      { id: outputIdRef.current++, type, text },
    ]);
  };

  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const handleSave = async () => {
    if (!actor) {
      toast.error("Not connected to backend");
      return;
    }
    if (!filename.trim()) {
      toast.error("Please enter a filename");
      return;
    }
    const name = filename.trim().endsWith(".py")
      ? filename.trim()
      : `${filename.trim()}.py`;

    setIsSaving(true);
    try {
      await actor.saveScript(name, { content: editorContent });
      setLocalFilename(name);
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

  // Keep ref up to date so parent's stable wrapper always calls latest version
  handleSaveRef.current = handleSave;

  // Register stable wrapper once
  useEffect(() => {
    onRegisterSave?.(() => handleSaveRef.current?.());
  }, [onRegisterSave]);

  const handleRun = async () => {
    if (!pyodideRef.current || isRunning) return;
    setIsRunning(true);
    setRunStatus("running");
    setOutputLines([]);
    outputIdRef.current = 0;

    pyodideRef.current.setStdout({
      batched: (text: string) => {
        const clean = text.endsWith("\n") ? text.slice(0, -1) : text;
        if (clean !== "") addOutputLine("out", clean);
      },
    });
    pyodideRef.current.setStderr({
      batched: (text: string) => {
        const clean = text.endsWith("\n") ? text.slice(0, -1) : text;
        if (clean !== "") addOutputLine("err", clean);
      },
    });

    try {
      const result = await pyodideRef.current.runPythonAsync(editorContent);
      if (result !== undefined && result !== null) {
        addOutputLine("out", String(result));
      }
      setRunStatus("success");
    } catch (e: any) {
      addOutputLine("err", e?.message ?? String(e));
      setRunStatus("error");
    } finally {
      setIsRunning(false);
    }
  };

  const handleClear = () => {
    setLocalContent("");
    setOutputLines([]);
    setRunStatus("idle");
  };

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = `${editorContent.substring(0, start)}    ${editorContent.substring(end)}`;
      setLocalContent(next);
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = start + 4;
          editorRef.current.selectionEnd = start + 4;
        }
      });
    }
    // Ctrl+S: save
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const RunIcon =
    runStatus === "running"
      ? Loader2
      : runStatus === "success"
        ? CheckCircle
        : runStatus === "error"
          ? AlertCircle
          : Play;

  const runIconClass =
    runStatus === "success"
      ? "text-term-keyword"
      : runStatus === "error"
        ? "text-term-error"
        : "";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0"
        style={{ background: "oklch(var(--ide-header))" }}
      >
        <Input
          value={filename}
          onChange={(e) => setLocalFilename(e.target.value)}
          className="h-7 w-48 text-xs font-mono bg-card border-border text-foreground"
          placeholder="untitled.py"
          data-ocid="editor.input"
        />

        <div className="flex items-center gap-1 ml-auto">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
            title="Clear editor"
            data-ocid="editor.clear_button"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`h-7 px-2 text-xs gap-1.5 hover:text-foreground ${runIconClass}`}
            onClick={handleRun}
            disabled={pyodideLoading || isRunning || !pyodide}
            title="Run script"
            data-ocid="editor.run_button"
          >
            <RunIcon
              className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`}
            />
            Run
          </Button>

          <Button
            size="sm"
            className="h-7 px-3 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleSave}
            disabled={isSaving}
            data-ocid="editor.save_button"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {isLoadingFile ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <HighlightedEditor
            ref={editorRef}
            value={editorContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onKeyDown={handleTab}
            placeholder={
              "# Write Python code here\n# Press Run to execute or Save to store it"
            }
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-ocid="editor.textarea"
            fontSize={fontSize}
            style={{ minHeight: 0 }}
          />
        )}

        {/* Output panel */}
        {(outputLines.length > 0 || runStatus !== "idle") && (
          <div
            className="shrink-0 border-t border-border"
            style={{ maxHeight: "200px" }}
          >
            <div
              className="flex items-center justify-between px-3 py-1 border-b border-border"
              style={{ background: "oklch(var(--ide-header))" }}
            >
              <span className="text-xs text-muted-foreground font-mono">
                Output
              </span>
              <div className="flex items-center gap-2">
                {runStatus === "success" && (
                  <span
                    className="text-xs text-term-keyword"
                    data-ocid="editor.success_state"
                  >
                    ✓ Done
                  </span>
                )}
                {runStatus === "error" && (
                  <span
                    className="text-xs text-term-error"
                    data-ocid="editor.error_state"
                  >
                    ✗ Error
                  </span>
                )}
                {runStatus === "running" && (
                  <span
                    className="text-xs text-primary"
                    data-ocid="editor.loading_state"
                  >
                    Running…
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOutputLines([]);
                    setRunStatus("idle");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Close output panel"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              ref={outputRef}
              className="overflow-y-auto p-3 font-mono text-xs leading-relaxed scrollbar-ide"
              style={{ maxHeight: "160px" }}
            >
              {outputLines.map((line) => (
                <div
                  key={line.id}
                  className={`whitespace-pre-wrap break-all ${
                    line.type === "err" ? "text-term-error" : "text-term-output"
                  }`}
                >
                  {line.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
