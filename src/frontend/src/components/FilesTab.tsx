import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useActor } from "@/hooks/useActor";
import { useListScripts } from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  FileCode,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FilesTabProps {
  onFileOpen: (name: string) => void;
  onNewFile: () => void;
}

function formatTime(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString();
}

export function FilesTab({ onFileOpen, onNewFile }: FilesTabProps) {
  const { data: scripts, isLoading, error, refetch } = useListScripts();
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const handleDelete = async (name: string) => {
    if (!actor) return;
    setDeletingName(name);
    try {
      await actor.deleteScript(name);
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
      queryClient.invalidateQueries({ queryKey: ["script", name] });
      toast.success(`Deleted ${name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0"
        style={{ background: "oklch(var(--ide-header))" }}
      >
        <span className="text-xs text-muted-foreground font-medium">
          {scripts
            ? `${scripts.length} file${scripts.length !== 1 ? "s" : ""}`
            : "Files"}
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => refetch()}
            title="Refresh"
            data-ocid="files.refresh_button"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onNewFile}
            data-ocid="files.new_button"
          >
            <Plus className="w-3.5 h-3.5" />
            New File
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto scrollbar-ide"
        data-ocid="files.list"
      >
        {isLoading && (
          <div
            className="flex items-center justify-center h-32 gap-2 text-muted-foreground"
            data-ocid="files.loading_state"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading files…</span>
          </div>
        )}

        {error && (
          <div
            className="flex items-center justify-center h-32 gap-2 text-term-error"
            data-ocid="files.error_state"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Failed to load files</span>
          </div>
        )}

        {!isLoading && !error && scripts?.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-48 gap-3"
            data-ocid="files.empty_state"
          >
            <FileCode className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No Python files yet</p>
            <Button
              size="sm"
              className="h-7 px-3 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onNewFile}
            >
              <Plus className="w-3.5 h-3.5" />
              Create your first script
            </Button>
          </div>
        )}

        {!isLoading && scripts && scripts.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-xs text-muted-foreground border-b border-border"
                style={{ background: "oklch(var(--ide-header))" }}
              >
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">
                  Preview
                </th>
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">
                  Modified
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {scripts.map((script, i) => (
                <tr
                  key={script.name}
                  className="border-b border-border/50 hover:bg-card/50 transition-colors group"
                  data-ocid={`files.item.${i + 1}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-mono text-xs text-foreground">
                        {script.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-xs text-muted-foreground truncate block max-w-xs">
                      {script.preview || "(empty)"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(script.updated)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => onFileOpen(script.name)}
                        data-ocid={`files.open_button.${i + 1}`}
                      >
                        <FolderOpen className="w-3 h-3" />
                        Open
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity gap-1 text-muted-foreground hover:text-destructive"
                            disabled={deletingName === script.name}
                            data-ocid={`files.delete_button.${i + 1}`}
                          >
                            {deletingName === script.name ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent
                          className="border-border bg-popover"
                          data-ocid="files.dialog"
                        >
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete {script.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                              This action cannot be undone. The file will be
                              permanently removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              className="border-border"
                              data-ocid="files.cancel_button"
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(script.name)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-ocid="files.confirm_button"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
