import { useListScripts } from "@/hooks/useQueries";
import { ChevronDown, FileCode, Loader2, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface SidebarProps {
  onFileOpen: (name: string) => void;
  onNewFile: () => void;
  selectedFile: string | null;
}

export function Sidebar({ onFileOpen, onNewFile, selectedFile }: SidebarProps) {
  const { data: scripts, isLoading } = useListScripts();

  return (
    <aside
      className="flex flex-col border-r border-border shrink-0 overflow-hidden"
      style={{
        width: "220px",
        background: "oklch(var(--sidebar))",
      }}
      data-ocid="sidebar.section"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0"
        style={{ background: "oklch(var(--ide-header))" }}
      >
        <div className="flex items-center gap-1.5">
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground tracking-wider uppercase">
            Files
          </span>
        </div>
        <button
          type="button"
          onClick={onNewFile}
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          title="New file"
          data-ocid="sidebar.new_button"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto scrollbar-ide py-1">
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        )}

        {!isLoading && (!scripts || scripts.length === 0) && (
          <div className="px-3 py-3 text-xs text-muted-foreground/60">
            No files yet.
          </div>
        )}

        <AnimatePresence initial={false}>
          {scripts?.map((script, i) => {
            const isActive = selectedFile === script.name;
            return (
              <motion.button
                key={script.name}
                type="button"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
                onClick={() => onFileOpen(script.name)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={
                  isActive ? { background: "oklch(var(--ide-tab-active))" } : {}
                }
                data-ocid={`sidebar.item.${i + 1}`}
              >
                <FileCode
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground/60"
                  }`}
                />
                <span className="font-mono truncate">{script.name}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </aside>
  );
}
