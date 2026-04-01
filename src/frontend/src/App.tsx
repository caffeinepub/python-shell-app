import { EditorPanel } from "@/components/EditorPanel";
import type { EditorPanelRef } from "@/components/EditorPanel";
import { FilesTab } from "@/components/FilesTab";
import type { OutputLine } from "@/components/OutputPanel";
import { OutputPanel } from "@/components/OutputPanel";
import { Sidebar } from "@/components/Sidebar";
import { TerminalTab } from "@/components/TerminalTab";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PyodideProvider, usePyodide } from "@/contexts/PyodideContext";
import {
  FolderOpen,
  Keyboard,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Settings,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

type RightTab = "output" | "console" | "files";

const SHORTCUTS = [
  { key: "F5", action: "Run script" },
  { key: "Shift+F5", action: "Run with arguments" },
  { key: "Ctrl+S", action: "Save file" },
  { key: "Ctrl+Shift+S", action: "Save As" },
  { key: "Ctrl+F", action: "Find & Replace" },
  { key: "Ctrl+G", action: "Go to line" },
  { key: "Tab", action: "Autocomplete / Indent" },
  { key: "↑ ↓", action: "History / navigate suggestions" },
  { key: "Escape", action: "Close dialogs / dropdown" },
  { key: "Ctrl+L", action: "Clear console" },
  { key: "Enter", action: "Run REPL input" },
  { key: "Shift+Enter", action: "New line (multi-line)" },
];

const FONT_FAMILIES = [
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "Consolas", label: "Consolas" },
  { value: "Courier New", label: "Courier New" },
  { value: "Fira Code", label: "Fira Code" },
  { value: "Monaco", label: "Monaco" },
];

const INDENT_OPTIONS = [
  { value: "2", label: "2 Spaces" },
  { value: "4", label: "4 Spaces" },
];

function IDELayout() {
  const { isLoading: pyLoading, loadingMessage, pyodide } = usePyodide();
  const pyodideRef = useRef<any>(null);
  pyodideRef.current = pyodide;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightTab, setRightTab] = useState<RightTab>("output");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filename, setFilename] = useState("main.py");
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState("JetBrains Mono");
  const [indentSize, setIndentSize] = useState(4);
  const [useTabs, setUseTabs] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [runStatus, setRunStatus] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [runDuration, setRunDuration] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [topPct, setTopPct] = useState(60);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [runArgsOpen, setRunArgsOpen] = useState(false);
  const [runArgs, setRunArgs] = useState("");

  const editorRef = useRef<EditorPanelRef>(null);
  const clearTerminalRef = useRef<() => void>(() => {});
  const outputIdRef = useRef(0);

  const addOutputLine = useCallback(
    (type: OutputLine["type"], text: string) => {
      setOutputLines((prev) => [
        ...prev,
        { id: outputIdRef.current++, type, text },
      ]);
    },
    [],
  );

  const runCode = useCallback(
    async (code: string) => {
      if (!pyodideRef.current || isRunning) return;
      setIsRunning(true);
      setRunStatus("running");
      setOutputLines([]);
      setRightTab("output");
      const start = performance.now();

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
        const result = await pyodideRef.current.runPythonAsync(code);
        if (result !== undefined && result !== null) {
          addOutputLine("out", String(result));
        }
        setRunStatus("success");
      } catch (e: any) {
        addOutputLine("err", e?.message ?? String(e));
        setRunStatus("error");
      } finally {
        const elapsed = (performance.now() - start) / 1000;
        setRunDuration(elapsed);
        setIsRunning(false);
      }
    },
    [isRunning, addOutputLine],
  );

  const handleRun = useCallback(async () => {
    const code = editorRef.current?.getCode() ?? "";
    await runCode(code);
  }, [runCode]);

  const handleRunWithArgs = useCallback(async () => {
    const code = editorRef.current?.getCode() ?? "";
    const argsList = runArgs
      .split(" ")
      .filter(Boolean)
      .map((a) => `"${a.replace(/"/g, '\\"')}"`);
    const argsStr = `["${filename}", ${argsList.join(", ")}]`;
    const prepended = `import sys\nsys.argv = ${argsStr}\n${code}`;
    setRunArgsOpen(false);
    await runCode(prepended);
  }, [runArgs, filename, runCode]);

  const handleCheckModule = useCallback(async () => {
    if (!pyodideRef.current) return;
    const code = editorRef.current?.getCode() ?? "";
    try {
      const escaped = code.replace(/\\/g, "\\\\").replace(/"""/g, '"\\""');
      await pyodideRef.current.runPythonAsync(
        `import ast\nast.parse("""${escaped}""")`,
      );
      toast.success("No syntax errors found ✓");
    } catch (e: any) {
      toast.error(`Syntax error: ${e?.message ?? String(e)}`);
    }
  }, []);

  const handleSaveAs = useCallback(async () => {
    const name = saveAsName.trim().endsWith(".py")
      ? saveAsName.trim()
      : `${saveAsName.trim()}.py`;
    setFilename(name);
    setSaveAsOpen(false);
    setSaveAsName("");
    setRecentFiles((prev) => {
      const next = [name, ...prev.filter((f) => f !== name)].slice(0, 5);
      return next;
    });
    editorRef.current?.triggerSave();
  }, [saveAsName]);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPct = topPct;
    const container = (e.currentTarget as HTMLElement).parentElement!;
    const totalH = container.getBoundingClientRect().height;
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const newPct = Math.min(
        80,
        Math.max(20, startPct + (delta / totalH) * 100),
      );
      setTopPct(newPct);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const mi = "text-xs cursor-pointer focus:bg-white/10 hover:bg-white/10";

  return (
    <TooltipProvider delayDuration={400}>
      <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
        {/* Header */}
        <header
          className="flex items-center h-10 shrink-0 border-b border-border px-2 gap-1"
          style={{ background: "oklch(var(--ide-header))" }}
          data-ocid="header.section"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                aria-label="Toggle sidebar"
                data-ocid="header.sidebar_toggle"
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1.5 px-2">
            <img
              src="/assets/generated/python-logo-transparent.dim_64x64.png"
              alt="Python"
              className="w-5 h-5 object-contain"
            />
            <span className="text-sm font-semibold text-foreground tracking-wide">
              Python IDE
            </span>
          </div>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Menu bar */}
          <nav
            className="flex items-center gap-0"
            aria-label="Application menu"
            data-ocid="header.menu.section"
          >
            {/* File menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                  data-ocid="header.menu.file_link"
                >
                  File
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="bg-popover border-border min-w-[180px]"
                sideOffset={4}
              >
                <DropdownMenuItem
                  className={mi}
                  onClick={() => {
                    setSelectedFile(null);
                    setFilename("untitled.py");
                  }}
                  data-ocid="header.menu.file.new_button"
                >
                  New File
                  <span className="ml-auto text-muted-foreground text-[10px]">
                    Ctrl+N
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mi}
                  onClick={() => setRightTab("files")}
                  data-ocid="header.menu.file.open_button"
                >
                  Open Files…
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  className={mi}
                  onClick={() => {
                    editorRef.current?.triggerSave();
                    setRecentFiles((prev) => {
                      const next = [
                        filename,
                        ...prev.filter((f) => f !== filename),
                      ].slice(0, 5);
                      return next;
                    });
                  }}
                  data-ocid="header.menu.file.save_button"
                >
                  Save
                  <span className="ml-auto text-muted-foreground text-[10px]">
                    Ctrl+S
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mi}
                  onClick={() => {
                    setSaveAsName(filename);
                    setSaveAsOpen(true);
                  }}
                  data-ocid="header.menu.file.secondary_button"
                >
                  Save As…
                  <span className="ml-auto text-muted-foreground text-[10px]">
                    Ctrl+Shift+S
                  </span>
                </DropdownMenuItem>
                {recentFiles.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="bg-border" />
                    <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                      Recent Files
                    </div>
                    {recentFiles.map((f) => (
                      <DropdownMenuItem
                        key={f}
                        className={mi}
                        onClick={() => {
                          setSelectedFile(f);
                          setFilename(f);
                        }}
                        data-ocid="header.menu.file.link"
                      >
                        {f}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Edit menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                  data-ocid="header.menu.edit_link"
                >
                  Edit
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="bg-popover border-border min-w-[180px]"
                sideOffset={4}
              >
                <DropdownMenuItem
                  className={mi}
                  onClick={() => clearTerminalRef.current()}
                  data-ocid="header.menu.edit.clear_button"
                >
                  Clear Console
                  <span className="ml-auto text-muted-foreground text-[10px]">
                    Ctrl+L
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mi}
                  onClick={() => {
                    setOutputLines([]);
                    setRunStatus("idle");
                  }}
                  data-ocid="header.menu.edit.copy_button"
                >
                  Clear Output
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Run menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                  data-ocid="header.menu.run_link"
                >
                  Run
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="bg-popover border-border min-w-[180px]"
                sideOffset={4}
              >
                <DropdownMenuItem
                  className={mi}
                  onClick={handleRun}
                  data-ocid="header.menu.run.run_button"
                >
                  ▶ Run Script
                  <span className="ml-auto text-muted-foreground text-[10px]">
                    F5
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mi}
                  onClick={() => setRunArgsOpen(true)}
                  data-ocid="header.menu.run.secondary_button"
                >
                  ▶ Run with Arguments…
                  <span className="ml-auto text-muted-foreground text-[10px]">
                    Shift+F5
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  className={mi}
                  onClick={handleCheckModule}
                  data-ocid="header.menu.run.check_button"
                >
                  ✓ Check Module
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mi}
                  onClick={() => toast.info("No script currently running")}
                  data-ocid="header.menu.run.stop_button"
                >
                  ■ Stop
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                  data-ocid="header.menu.view_link"
                >
                  View
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="bg-popover border-border min-w-[160px]"
                sideOffset={4}
              >
                <DropdownMenuItem
                  className={mi}
                  onClick={() => setSidebarOpen((v) => !v)}
                  data-ocid="header.menu.view.sidebar_toggle"
                >
                  {sidebarOpen ? "Hide" : "Show"} Sidebar
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  className={mi}
                  onClick={() => setRightTab("output")}
                  data-ocid="header.menu.view.output_tab"
                >
                  Output
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mi}
                  onClick={() => setRightTab("console")}
                  data-ocid="header.menu.view.console_tab"
                >
                  Console (REPL)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mi}
                  onClick={() => setRightTab("files")}
                  data-ocid="header.menu.view.files_tab"
                >
                  Files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Tools menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                  data-ocid="header.menu.tools_link"
                >
                  Tools
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="bg-popover border-border min-w-[180px]"
                sideOffset={4}
              >
                <DropdownMenuItem
                  className={mi}
                  onClick={() =>
                    toast.info("Tip: use 4-space indentation (PEP 8)")
                  }
                  data-ocid="header.menu.tools.format_button"
                >
                  Format Code (PEP 8)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mi}
                  onClick={() => {
                    clearTerminalRef.current();
                    toast.success("Console cleared");
                  }}
                  data-ocid="header.menu.tools.clear_button"
                >
                  Clear Console
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Help menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                  data-ocid="header.menu.help_link"
                >
                  Help
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="bg-popover border-border min-w-[160px]"
                sideOffset={4}
              >
                <DropdownMenuItem
                  className={mi}
                  onClick={() => setShortcutsOpen(true)}
                  data-ocid="header.menu.help.shortcuts_button"
                >
                  <Keyboard className="w-3.5 h-3.5 mr-2" />
                  Keyboard Shortcuts
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mi}
                  onClick={() => setAboutOpen(true)}
                  data-ocid="header.menu.help.about_button"
                >
                  About
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setRightTab("files")}
                  className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  aria-label="Files"
                  data-ocid="header.files_button"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Files</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  aria-label="Settings"
                  data-ocid="header.settings_button"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>

            {/* Run button */}
            <button
              type="button"
              onClick={handleRun}
              disabled={pyLoading || isRunning}
              className="flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isRunning
                  ? "oklch(0.57 0 0)"
                  : "oklch(var(--ide-run))",
                color: "oklch(var(--ide-run-fg))",
              }}
              aria-label={isRunning ? "Running\u2026" : "Run script"}
              data-ocid="header.run_button"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Running\u2026
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Run
                </>
              )}
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Top zone: sidebar + editor */}
          <div
            className="flex flex-row overflow-hidden"
            style={{ height: `${topPct}%` }}
          >
            {sidebarOpen && (
              <Sidebar
                onFileOpen={(f) => {
                  setSelectedFile(f);
                  setFilename(f);
                }}
                selectedFile={selectedFile}
                onNewFile={() => {
                  setSelectedFile(null);
                  setFilename("untitled.py");
                }}
              />
            )}

            {/* Editor pane */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              {/* Tab strip */}
              <div
                className="flex items-end h-9 shrink-0 border-b border-border px-2"
                style={{ background: "oklch(var(--ide-header))" }}
              >
                <div
                  className="flex items-center gap-1.5 px-3 h-8 text-xs border-b-2 font-medium"
                  style={{
                    background: "oklch(var(--ide-tab-active))",
                    borderColor: "oklch(var(--primary))",
                    color: "oklch(var(--foreground))",
                  }}
                >
                  <img
                    src="/assets/generated/python-logo-transparent.dim_64x64.png"
                    alt="Python"
                    className="w-3.5 h-3.5 object-contain"
                  />
                  <input
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs font-mono w-32"
                    style={{ color: "inherit" }}
                    spellCheck={false}
                    aria-label="Filename"
                    data-ocid="editor.input"
                  />
                </div>
              </div>

              <EditorPanel
                ref={editorRef}
                selectedFile={selectedFile}
                filename={filename}
                onFilenameChange={setFilename}
                onFileSaved={(name) => {
                  setSelectedFile(name);
                  setFilename(name);
                  setRecentFiles((prev) =>
                    [name, ...prev.filter((f) => f !== name)].slice(0, 5),
                  );
                }}
                fontSize={fontSize}
                fontFamily={fontFamily}
                indentSize={useTabs ? 1 : indentSize}
              />
            </div>
          </div>

          {/* Horizontal resize handle */}
          <div
            className="resize-handle"
            onMouseDown={handleDividerMouseDown}
            data-ocid="editor.drag_handle"
          />

          {/* Bottom pane */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Tab strip */}
            <div
              className="flex items-end h-9 shrink-0 border-b border-border px-2 gap-0.5"
              style={{ background: "oklch(var(--ide-header))" }}
            >
              {(["output", "console", "files"] as RightTab[]).map((tab) => {
                const isActive = rightTab === tab;
                const label =
                  tab === "output"
                    ? "Output"
                    : tab === "console"
                      ? "Console"
                      : "Files";
                const icon =
                  tab === "output" ? "▶" : tab === "console" ? "$" : "📁";
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRightTab(tab)}
                    className={`flex items-center gap-1.5 px-3 h-8 text-xs rounded-t transition-all ${
                      isActive
                        ? "text-foreground font-medium border-b-2"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                    style={
                      isActive
                        ? {
                            background: "oklch(var(--ide-tab-active))",
                            borderColor: "oklch(var(--primary))",
                          }
                        : {}
                    }
                    data-ocid={`tabs.${tab}_tab`}
                  >
                    <span className="text-[10px] opacity-60">{icon}</span>
                    {label}
                    {tab === "output" && runStatus === "running" && (
                      <Loader2 className="w-3 h-3 animate-spin ml-1" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-hidden relative">
              <div
                className={`absolute inset-0 ${
                  rightTab === "output" ? "flex flex-col" : "hidden"
                }`}
              >
                <OutputPanel
                  lines={outputLines}
                  runStatus={runStatus}
                  runDuration={runDuration}
                  onClear={() => {
                    setOutputLines([]);
                    setRunStatus("idle");
                    setRunDuration(null);
                  }}
                  fontSize={fontSize}
                />
              </div>
              <div
                className={`absolute inset-0 ${
                  rightTab === "console" ? "flex flex-col" : "hidden"
                }`}
              >
                <TerminalTab
                  onRegisterClear={(fn) => {
                    clearTerminalRef.current = fn;
                  }}
                  fontSize={fontSize}
                />
              </div>
              <div
                className={`absolute inset-0 ${
                  rightTab === "files" ? "flex flex-col" : "hidden"
                }`}
              >
                <FilesTab
                  onFileOpen={(f) => {
                    setSelectedFile(f);
                    setFilename(f);
                  }}
                  onNewFile={() => {
                    setSelectedFile(null);
                    setFilename("untitled.py");
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <footer
          className="flex items-center gap-3 px-4 h-6 shrink-0 border-t border-border text-xs font-mono"
          style={{ background: "oklch(var(--ide-activitybar))" }}
          data-ocid="statusbar.section"
        >
          <span style={{ color: "oklch(var(--primary))" }}>Python 3.11</span>
          <span className="text-border select-none">|</span>
          <span className="text-muted-foreground">Pyodide 0.26.4</span>
          <span className="text-border select-none">|</span>
          <span className="text-muted-foreground">
            UTF-{useTabs ? "TAB" : `${indentSize}SP`}
          </span>
          <span className="text-border select-none">|</span>
          <span
            className={pyLoading ? "text-accent" : "text-term-builtin"}
            data-ocid={
              pyLoading ? "statusbar.loading_state" : "statusbar.success_state"
            }
          >
            {pyLoading ? loadingMessage : "Ready"}
          </span>
          <div className="flex-1" />
          <span className="text-muted-foreground/60">
            &copy; {new Date().getFullYear()} &middot;{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              caffeine.ai
            </a>
          </span>
        </footer>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          className="border-border bg-popover max-w-sm"
          data-ocid="settings.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-sm">Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Font size */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Font Size
                </Label>
                <span className="text-xs font-mono text-foreground">
                  {fontSize}px
                </span>
              </div>
              <Slider
                min={11}
                max={20}
                step={1}
                value={[fontSize]}
                onValueChange={([v]) => setFontSize(v)}
                className="w-full"
                data-ocid="settings.select"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>11px</span>
                <span>20px</span>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Font family */}
            <div className="flex items-center justify-between gap-4">
              <Label className="text-xs text-muted-foreground">
                Font Family
              </Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger
                  className="h-7 text-xs w-40"
                  data-ocid="settings.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {FONT_FAMILIES.map((f) => (
                    <SelectItem
                      key={f.value}
                      value={f.value}
                      className="text-xs"
                    >
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-border" />

            {/* Indentation */}
            <div className="flex items-center justify-between gap-4">
              <Label className="text-xs text-muted-foreground">
                Indent Size
              </Label>
              <Select
                value={String(indentSize)}
                onValueChange={(v) => setIndentSize(Number(v))}
              >
                <SelectTrigger
                  className="h-7 text-xs w-28"
                  data-ocid="settings.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {INDENT_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-xs"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Use tabs */}
            <div className="flex items-center justify-between gap-4">
              <Label className="text-xs text-muted-foreground">Use Tabs</Label>
              <Switch
                checked={useTabs}
                onCheckedChange={setUseTabs}
                data-ocid="settings.switch"
              />
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Theme</Label>
              <span className="text-xs text-foreground px-2 py-0.5 rounded border border-border">
                Dark (Python)
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shortcuts Dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent
          className="border-border bg-popover max-w-md"
          data-ocid="shortcuts.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Keyboard className="w-4 h-4" /> Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            {SHORTCUTS.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
              >
                <span className="text-xs text-muted-foreground">
                  {s.action}
                </span>
                <kbd className="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-card text-foreground">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* About Dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent
          className="border-border bg-popover max-w-sm"
          data-ocid="about.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <img
                src="/assets/generated/python-logo-transparent.dim_64x64.png"
                alt="Python"
                className="w-5 h-5 object-contain"
              />
              About Python IDE
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs text-muted-foreground">
            <p>
              A professional browser-based Python IDE powered by{" "}
              <a
                href="https://pyodide.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Pyodide
              </a>{" "}
              — Python 3.11 running entirely in your browser via WebAssembly.
            </p>
            <p>
              Features: split-pane editor, interactive REPL, syntax
              highlighting, autocomplete, calltips, Find &amp; Replace,
              auto-indent, file manager.
            </p>
            <p className="text-[10px] text-muted-foreground/60 pt-1">
              Built with React + Pyodide + Internet Computer
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save As Dialog */}
      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent
          className="border-border bg-popover max-w-sm"
          data-ocid="saveas.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-sm">Save As</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Filename
              </Label>
              <input
                type="text"
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAs();
                }}
                className="w-full px-3 py-2 text-xs rounded border border-border bg-card text-foreground outline-none focus:border-primary"
                placeholder="filename.py"
                data-ocid="saveas.input"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSaveAsOpen(false)}
                className="px-3 py-1.5 text-xs rounded border border-border hover:bg-white/5"
                data-ocid="saveas.cancel_button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAs}
                className="px-3 py-1.5 text-xs rounded"
                style={{
                  background: "oklch(var(--primary))",
                  color: "oklch(var(--primary-foreground))",
                }}
                data-ocid="saveas.confirm_button"
              >
                Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Run with Arguments Dialog */}
      <Dialog open={runArgsOpen} onOpenChange={setRunArgsOpen}>
        <DialogContent
          className="border-border bg-popover max-w-sm"
          data-ocid="runargs.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Play className="w-4 h-4" /> Run with Arguments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Command-line arguments (space-separated)
              </Label>
              <input
                type="text"
                value={runArgs}
                onChange={(e) => setRunArgs(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRunWithArgs();
                }}
                className="w-full px-3 py-2 text-xs rounded border border-border bg-card text-foreground outline-none focus:border-primary font-mono"
                placeholder="arg1 arg2 arg3"
                data-ocid="runargs.input"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                sys.argv[0] will be set to "{filename}"
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRunArgsOpen(false)}
                className="px-3 py-1.5 text-xs rounded border border-border hover:bg-white/5"
                data-ocid="runargs.cancel_button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunWithArgs}
                className="px-3 py-1.5 text-xs rounded flex items-center gap-1.5"
                style={{
                  background: "oklch(var(--ide-run))",
                  color: "oklch(var(--ide-run-fg))",
                }}
                data-ocid="runargs.confirm_button"
              >
                <Play className="w-3 h-3" /> Run
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster theme="dark" richColors />
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <PyodideProvider>
      <IDELayout />
    </PyodideProvider>
  );
}
